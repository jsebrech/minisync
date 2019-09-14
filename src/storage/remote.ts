import { Document } from "../document";
import { ClientID, dateToString, ObjectDataType, ObjectID, padStr, Peer } from "../types";
import { ClientIndex, FileData, FileHandle, MasterIndex, RemoteClientIndex, RemoteStore } from "./types";

// Syncing documents to remote stores

// 1 MB
const DEFAULT_PART_SIZE_LIMIT = 1024 * 1024;

interface SaveRemoteOptions {
    /** human-readable name of the client doing the syncing */
    clientName ?: string;
    /** soft limit for the maximum size in bytes of a part saved to a remote store */
    partSizeLimit ?: number;
}

/**
 * Saves a document to a remote store for the current client (if changed)
 * @param document The document to save
 * @param store The remote store to save to
 * @param options Additional configuration options
 * @return the updated client index in case data was saved, null otherwise
 *
 * The remote store is organized like this:
 * - `documents/`
 *   - `document-{id}/`: all data for a specific document belonging to this store's user
 *     - `client-{id}/`; data for a specific client that the user has synced
 *       - `client-index.json`: index of data parts for this client
 *       - `part-00000XYZ.json`: a changes file for a particular range of versions uploaded by this client
 *       - `part-...`
 *    - `master-index.json`: the index for all the user's clients that have synced to this folder
 */
export function saveRemote(
    document: Document, store: RemoteStore, options?: SaveRemoteOptions
    ): Promise<RemoteClientIndex> {
    // what have we stored before?
    return getClientIndex(document.getID(), document.getClientID(), store)
        .then((clientIndex: ClientIndex) => {
            if (!options) options = {};
            // if we've never written to this store for this client, create a fresh client index
            if (!clientIndex) {
                clientIndex = newClientIndex(document.getClientID(), options.clientName);
            }
            // determine the part file to write to (append latest or start new)
            // the document is chunked across multiple files to keep files reasonably sized for network transfer
            let writeToPart = clientIndex.parts.slice().pop();
            if (writeToPart.size > (options.partSizeLimit || DEFAULT_PART_SIZE_LIMIT)) {
                writeToPart = {
                    id: writeToPart.id + 1,
                    fromVersion: writeToPart.toVersion,
                    toVersion: writeToPart.toVersion,
                    url: null,
                    size: 0
                };
                clientIndex.parts.push(writeToPart);
            }
            // write changes to the part file, if necessary (version is newer than part file)
            if (!writeToPart.fromVersion || (document.getDocVersion() > writeToPart.toVersion)) {
                writeToPart.toVersion = document.getDocVersion();
                const data = document.getChanges(writeToPart.fromVersion);
                const dataStr = JSON.stringify(data);
                writeToPart.size = dataStr.length;
                return store.putFile({
                    path: pathFor(document.getID(), document.getClientID()),
                    fileName: "part-" + padStr(String(writeToPart.id), 8) + ".json",
                    contents: dataStr
                }).then(async (remotePartFile) => {
                    writeToPart.url = remotePartFile.url;
                    // update the client index and master index
                    clientIndex.latest = writeToPart.toVersion;
                    clientIndex.updated = dateToString(new Date());
                    if (options.clientName) clientIndex.clientName = options.clientName;
                    const clientIndexFile = await store.putFile({
                        path: pathFor(document.getID(), clientIndex.clientID),
                        fileName: "client-index.json",
                        contents: JSON.stringify(clientIndex)
                    });
                    const masterIndexFile =
                        await updateMasterIndex(document, clientIndex, clientIndexFile.url, store);
                    return { ...clientIndex,
                             url: clientIndexFile.url, masterIndexUrl: masterIndexFile.url };
                });
            } else return null;
        });
}

/**
 * Create a document by restoring it from the latest version in a store
 * @param documentID The document's ID
 * @param store The remote store to fetch it from
 * @param forClientID Instead of restoring the latest version as a new client,
 * restore as this client ID from that client's remote version
 */
export function createFromRemote(
    documentID: ObjectID, store: RemoteStore, forClientID ?: ObjectID
): Promise<Document> {
    // get our master index
    return getMasterIndex(documentID, store)
        // and find the right client's index
        .then((masterIndex) =>
            getClientIndex(documentID, forClientID || masterIndex.latestUpdate.clientID, store))
        // get that client's data parts (changes object files)
        .then(async (clientIndex) => {
            const files = await Promise.all(
                // fetch in parallel
                clientIndex.parts.map((part) => store.getFile({
                    path: pathFor(documentID, clientIndex.clientID),
                    fileName: "part-" + padStr(String(part.id), 8) + ".json"
                }).then((file) => file.contents))
            );
            // for this client, we must merge these change parts
            return {
                clientIndex,
                parts: files
            };
        })
        // and reconstruct a document from those parts
        .then((changes) => documentFromClientData(changes, forClientID));
}

/**
 * Create a document by restoring it from a remote url (of a master index file)
 * @param url The URL of the master index to restore from
 * @param stores The set of remote stores to try downloading it through (first one that matches will download)
 * @return A promise for a new Document instance, which is rejected if it is unable to restore from that url
 */
export async function createFromUrl(url: string, stores: RemoteStore[]): Promise<Document> {
    const store = stores.find((store) => store.canDownloadUrl(url));
    if (store) {
        // get their master index
        const masterIndex: MasterIndex = await store.downloadUrl(url)
            .then((file) => parseJsonAs(
                { path: [], fileName: url, contents: file},
                ObjectDataType.MasterIndex
            ));
        masterIndex.url = url;
        const client = masterIndex.clients[masterIndex.latestUpdate.clientID];
        if (!client) {
            return Promise.reject(new Error(
                `unable to parse master index at ${url}, latest updated client not found`));
        }
        const clientIndex: ClientIndex =
            await store.downloadUrl(client.url)
            .then((file) => parseJsonAs(
                { path: [], fileName: client.url, contents: file},
                ObjectDataType.ClientIndex
            ));
        const files = await Promise.all(
            // fetch in parallel
            clientIndex.parts.map((part) => store.downloadUrl(part.url))
        );
        // for this client, we must merge these change parts
        // and restore a document from those parts
        return documentFromClientData({
            clientIndex,
            parts: files
        }, null, masterIndex);
    }
    return Promise.reject(new Error(`unable to download ${url} as a document`));
}

/**
 * Merge changes from this user's other clients in a remote store
 * @param document The documet to merge changes into (this is modified by this operation!)
 * @param store The store to merge changes from
 * @return The document after the changes are applied to it
 */
export async function mergeFromRemoteClients(document: Document, store: RemoteStore): Promise<Document> {
    // get master index to find a list of our clients
    const masterIndex = await getMasterIndex(document.getID(), store);
    const clientStates = document.getClientStates();

    // filter to those clients we need to sync with (are newer than we've synced with)
    const clients = Object.entries(masterIndex.clients).filter(([clientID, client]) => {
        const previous = clientStates.find((s) => s.clientID === clientID);
        return !previous || (previous.lastReceived < client.lastReceived);
    }).map((v) => v[0]);

    // fetch client indexes for those clients in parallel
    // note: we download only a subset of client indexes here, even though the master index may be out of date
    // (mid-update) because it would slow us down a lot and it should fix itself on the next sync.
    const clientIndexes =
        await Promise.all(clients.map((clientID) => getClientIndex(document.getID(), clientID, store)));

    return mergeClients(document, clientIndexes, [store]);
}

/**
 * Merge changes from other users
 * @param document The document to merge changes into (this is modified by this operation!)
 * @param myStore The store our document is kept in (keeps the master index)
 * @param allStores All stores that can be used to download changes from other users
 * @return The document after the changes are applied to it
 */
export async function mergeFromRemotePeers(
    document: Document, myStore: RemoteStore, allStores: RemoteStore[]
): Promise<Document> {
    const myMasterIndex = await getMasterIndex(document.getID(), myStore);

    // construct the list of peers to obtain changes from (from masterindex)
    // filter to those peers we need to sync with (are newer than we've synced with)
    // and can sync with (actually responds when we try to fetch their master index)
    const peers: MasterIndex[] = (await Promise.all(myMasterIndex.peers.map((peer) =>
        getRemoteFile(peer.url, allStores)
            .then((file) => parseJsonAs(file, ObjectDataType.MasterIndex) as MasterIndex)
            .then((theirMasterIndex) => {
                // have we already seen this version, then ignore it, otherwise sync with it
                return document.isNewerThan(theirMasterIndex.latestUpdate) ? null : theirMasterIndex;
            })
            .catch((e) => null) // ignore any master index we couldn't fetch
    ))).filter((s) => !!s); // remove nulls

    // for every peer, obtain the client index for the latest updated client of that peer
    // (this should already contain the clientState of the clients we know)
    // as well as the parts files and merge them into the document
    const clientIndexes: ClientIndex[] = (await Promise.all(peers.map((peer) => {
        const client = peer.clients[peer.latestUpdate.clientID];
        return getRemoteFile(client.url, allStores)
            .then((file) => parseJsonAs(file, ObjectDataType.ClientIndex) as ClientIndex)
            .catch((e) => null); // ignore any client index we couldn't fetch
    }))).filter((s) => !!s); // remove nulls

    return mergeClients(document, clientIndexes, allStores);
}

export function getMasterIndex(documentID: ObjectID, store: RemoteStore): Promise<MasterIndex> {
    return store.getFile({
        path: pathFor(documentID),
        fileName: "master-index.json"
    }).then((file) =>
        parseJsonAs(file, ObjectDataType.MasterIndex) as MasterIndex);
}

/**
 * Merge a series of remote clients into a document
 * @param document The document to merge the client data into
 * @param clientIndexes The data for the clients to merge
 * @param stores The stores to try to fetch client data through
 * @return The document with the merged changes
 */
async function mergeClients(
    document: Document, clientIndexes: ClientIndex[], stores: RemoteStore[]): Promise<Document> {
    const clientStates = document.getClientStates();

    const changes = await Promise.all(clientIndexes.map(async (clientIndex) => {
        try {
            const previous = clientStates.find((s) => s.clientID === clientIndex.clientID);
            const parts =
                clientIndex.parts.filter((part) => (!previous) || (previous.lastReceived < part.toVersion));
            const files = await Promise.all(
                // fetch in parallel
                parts.map((part) => getRemoteFile(part.url, stores).then(JSON.parse))
            );
            // for this client, we must merge these change parts
            return {
                clientIndex,
                parts: files
            };
        } catch (e) {
            return null; // for any error, skip this client
        }
    }));

    // merge all the parts into the document, sequentially by client, and then by part
    for (const change of changes) {
        for (const part of change.parts) {
            document.mergeChanges(part);
        }
    }

    return document;
}

function updateMasterIndex(
    document: Document, clientIndex: ClientIndex, clientIndexUrl: string, store: RemoteStore
): Promise<MasterIndex> {
    return getMasterIndex(document.getID(), store)
        .then((masterIndex) => {
            // if we've never written to this store for this client, create a fresh client index
            if (!masterIndex) {
                masterIndex = newMasterIndex(document);
            }
            // update this client's info in the master index
            masterIndex.clients[clientIndex.clientID] = {
                url: clientIndexUrl,
                lastReceived: clientIndex.latest,
                label: clientIndex.clientName
            };
            masterIndex.latestUpdate = {
                clientID: clientIndex.clientID,
                updated: clientIndex.updated,
                version: clientIndex.latest
            };
            masterIndex.peers = document.getPeers();
            return store.putFile({
                path: pathFor(document.getID()),
                fileName: "master-index.json",
                contents: JSON.stringify(masterIndex)
            }).then(async (savedFile) => {
                // if the file was published at a new url, save it again with that url embedded
                if (masterIndex.url !== savedFile.url) {
                    masterIndex.url = savedFile.url;
                    await store.putFile({
                        path: pathFor(document.getID()),
                        fileName: "master-index.json",
                        contents: JSON.stringify(masterIndex)
                    });
                }
                return masterIndex;
            });
        });
}

export function getClientIndex(documentID: ObjectID, clientID: ClientID, store: RemoteStore): Promise<ClientIndex> {
    return store.getFile({
        path: pathFor(documentID, clientID),
        fileName: "client-index.json"
    }).then((file) =>
        parseJsonAs(file, ObjectDataType.ClientIndex) as ClientIndex);
}

export function getRemoteFile(url: string, stores: RemoteStore[]): Promise<string> {
    for (const store of stores) {
        if (store.canDownloadUrl(url)) {
            return store.downloadUrl(url);
        }
    }
    return Promise.reject(new Error("no compatible store"));
}

function fileKnownAs(json: any, dataType: ObjectDataType): boolean {
    return (json && json._minisync && (json._minisync.dataType === dataType));
}

function parseJsonAs<T>(file: FileData|string, dataType: ObjectDataType): T {
    if (file === null) return null;
    const result = JSON.parse(typeof file === "string" ? file : file.contents);
    if (!fileKnownAs(result, dataType)) {
        switch (dataType) {
            case ObjectDataType.ClientIndex:
                throw errorFor(file, "not a client index file");
            case ObjectDataType.MasterIndex:
                throw errorFor(file, "not a master index file");
            default:
                throw errorFor(file, "unrecognized type: " + dataType);
        }
    }
    return result as T;
}

function pathFor(documentID: ObjectID, clientID?: ClientID): string[] {
    const path = ["documents", "document-" + documentID];
    if (clientID) {
        path.push("client-" + clientID);
    }
    return path;
}

function errorFor(handle: FileHandle|string, message: string): Error {
    return new Error("Error at " +
        ((typeof handle === "string") ? handle :
            [].concat(handle.path, [handle.fileName]).filter((s: any) => s).join("/")) +
        (message ? ": " + message : ""));
}

function newClientIndex(clientID: ClientID, clientName: string): ClientIndex {
    return {
        _minisync: {
            dataType: ObjectDataType.ClientIndex,
            version: 1
        },
        latest: null,
        updated: null,
        clientID,
        clientName,
        parts: [{
            id: 0,
            fromVersion: null,
            toVersion: null,
            url: null,
            size: 0
        }]
    };
}

function newMasterIndex(document: Document): MasterIndex {
    return {
        _minisync: {
            dataType: ObjectDataType.MasterIndex,
            version: 1
        },
        label: null,
        clients: {},
        peers: [],
        latestUpdate: null,
        url: null
    };
}

interface ClientData {
    clientIndex: ClientIndex;
    parts: string[];
}

function documentFromClientData(
    changes: ClientData, forClientID ?: ObjectID, fromPeer ?: Peer
): Document {
    const parts = changes.parts.slice();
    if (parts.length) {
        const document = new Document(
            JSON.parse(parts.shift()), changes.clientIndex.clientID === forClientID);
        for (const part of parts) {
            document.mergeChanges(JSON.parse(part));
        }
        if (fromPeer) document.addPeer(fromPeer);
        return document;
    }
    throw new Error("unable to restore documents, no changes data to restore from");
}
