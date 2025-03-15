import { Document } from "../document";
import { defaultLogger, Logger } from "../logging";
import { ClientID, dateToString, ObjectDataType, ObjectID, Peer } from "../types";
import { ClientIndex, FileData, FileHandle, MasterIndex, ProgressFunction,
         RemoteClientIndex, RemoteStore, ClientIndexPart } from "./types";

// 1 MB
const DEFAULT_PART_SIZE_LIMIT = 1024 * 1024;

/**
 * Syncing documents to remote stores
 */
export class RemoteSync {

    constructor(
        /** the default store where we store documents */
        public readonly store: RemoteStore,
        /** the stores through which documents from peers are downloaded */
        public readonly allStores: RemoteStore[] = [store],
        /** the logger used for error and debug logging */
        private logger: Logger = defaultLogger()
    ) { }

    /**
     * Saves a document to a remote store for the current client (if changed)
     * @param document The document to save
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
    public saveRemote(
        document: Document, options?: SaveRemoteOptions
        ): Promise<RemoteClientIndex|null> {
        // what have we stored before?
        this.logger.debug(`saveRemote - saving document ${document.getID()}...`);
        return this.getClientIndex(document.getID(), document.getClientID())
            .then((clientIndex: ClientIndex) => {
                if (!options) options = {};
                const onProgress = (p: number) => {
                    this.logger.debug(`saveRemote - ${Math.round(p * 100)}% complete`);
                    (options?.onProgress || defaultProgress)(p);
                };
                onProgress(0.2); // 1 of 5 calls made
                // if we've never written to this store for this client, create a fresh client index
                if (!clientIndex) {
                    clientIndex = newClientIndex(
                        document.getClientID(), 
                        options.clientName);
                }
                // determine the part file to write to (append latest or start new)
                // the document is chunked across multiple files to keep files reasonably sized for network transfer
                let writeToPart = clientIndex.parts.slice().pop() || null;
                if (!writeToPart) {
                    // start first part
                    writeToPart = {
                        id: 0,
                        fromVersion: null,
                        toVersion: null,
                        url: null,
                        size: 0
                    }
                    clientIndex.parts.push(writeToPart);
                } else if (writeToPart.size > (options.partSizeLimit || DEFAULT_PART_SIZE_LIMIT)) {
                    // part is full, start next part
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
                if (!writeToPart.fromVersion || 
                    (!writeToPart.toVersion || document.getDocVersion() > writeToPart.toVersion)) {
                    writeToPart.toVersion = document.getDocVersion();
                    const data = document.getChanges(writeToPart.fromVersion || undefined);
                    const dataStr = JSON.stringify(data);
                    writeToPart.size = dataStr.length;
                    return this.store.putFile({
                        path: pathFor(document.getID(), document.getClientID()),
                        fileName: "part-" + String(writeToPart.id).padStart(8, "0") + ".json",
                        contents: dataStr
                    }).then(async (remotePartFile) => {
                        onProgress(0.4); // 2 of 5 calls
                        writeToPart.url = remotePartFile.url;
                        // update the client index and master index
                        clientIndex.latest = writeToPart.toVersion!;
                        clientIndex.updated = dateToString(new Date());
                        if (options?.clientName) clientIndex.clientName = options.clientName;
                        const clientIndexFile = await this.store.putFile({
                            path: pathFor(document.getID(), clientIndex.clientID),
                            fileName: "client-index.json",
                            contents: JSON.stringify(clientIndex)
                        });
                        onProgress(0.6); // 3 of 5 calls made
                        const masterIndexFile =
                            await this.updateMasterIndex(document, clientIndex, clientIndexFile.url, this.store);
                        this.logger.debug(`saveRemote - saved changes for document ${document.getID()}`);
                        return { ...clientIndex,
                                url: clientIndexFile.url, masterIndexUrl: masterIndexFile.url };
                    });
                } else {
                    this.logger.debug(`saveRemote - no changes to write for document ${document.getID()}`);
                    return null;
                }
            });
    }

    /**
     * Create a document by restoring it from the latest version in a store
     * @param documentID The document's ID
     * @param forClientID Instead of restoring the latest version as a new client,
     * restore as this client ID from that client's remote version
     */
    public createFromRemote(
        documentID: ObjectID, forClientID ?: ObjectID
    ): Promise<Document> {
        // get our master index
        return this.getMasterIndex(documentID)
            // and find the right client's index
            .then((masterIndex) =>
                this.getClientIndex(documentID, forClientID || masterIndex.latestUpdate!.clientID))
            // get that client's data parts (changes object files)
            .then(async (clientIndex) => {
                const files = await Promise.all(
                    // fetch in parallel
                    clientIndex.parts.map((part) => this.store.getFile({
                        path: pathFor(documentID, clientIndex.clientID),
                        fileName: "part-" + String(part.id).padStart(8, "0") + ".json"
                    }).then((file) => file?.contents))
                );
                // for this client, we must merge these change parts
                return {
                    clientIndex,
                    parts: files.filter(f => !!f) as string[]
                };
            })
            // and reconstruct a document from those parts
            .then((changes) => documentFromClientData(changes, forClientID));
    }

    /**
     * Create a document by restoring it from a remote url (of a master index file)
     * @param url The URL of the master index to restore from
     * @return A promise for a new Document instance, which is rejected if it is unable to restore from that url
     */
    public async createFromUrl(url: string): Promise<Document> {
        const store = (await Promise.all(
            // call out to the stores in parallel to figure out which one can download this
            this.allStores.map((store) => ({ store, canDownload: store.canDownloadUrl(url) }))
        )).filter((o) => o.canDownload).map((o) => o.store)[0];
        if (store) {
            // get their master index
            const masterIndex: MasterIndex|null = await store.downloadUrl(url)
                .then((file) => parseJsonAs(
                    { path: [], fileName: url, contents: file},
                    ObjectDataType.MasterIndex
                ));
            if (!masterIndex) {
                return Promise.reject(new Error(`unable to parse master index at ${url}`));
            }
            masterIndex.url = url;
            const client = masterIndex.clients[masterIndex.latestUpdate!.clientID];
            if (!client) {
                return Promise.reject(new Error(
                    `unable to parse master index at ${url}, latest updated client not found`));
            }
            const clientIndex: ClientIndex|null =
                await store.downloadUrl(client.url)
                .then((file) => parseJsonAs(
                    { path: [], fileName: client.url, contents: file},
                    ObjectDataType.ClientIndex
                ));
            if (!clientIndex) {
                return Promise.reject(new Error(`unable to parse client index at ${client.url}`));
            }
            const files: string[] = await Promise.all(
                // fetch in parallel
                clientIndex.parts.map(part => part.url && store.downloadUrl(part.url))
            ).then(values => values.filter(file => file) as string[]);
            // for this client, we must merge these change parts
            // and restore a document from those parts
            return documentFromClientData({
                clientIndex,
                parts: files
            }, undefined, masterIndex);
        }
        return Promise.reject(new Error(`unable to download ${url} as a document`));
    }

    /**
     * Merge changes from this user's other clients in a remote store
     * @param document The documet to merge changes into (this is modified by this operation!)
     * @param ProgressFunction A function called to indicate progress of this operation (optional).
     * @return The document after the changes are applied to it
     */
    public async mergeFromRemoteClients(
        document: Document,
        onProgress: ProgressFunction = defaultProgress
    ): Promise<Document> {
        this.logger.debug(`mergeFromRemoteClients - merging into document ${document.getID()}...`);
        const logProgress = (p: number) => {
            this.logger.debug(`mergeFromRemoteClients - ${Math.round(p * 100)}%`);
            onProgress(p);
        };
        // get master index to find a list of our clients
        const masterIndex = await this.getMasterIndex(document.getID());
        const clientStates = document.getClientStates();

        // filter to those clients we need to sync with (are newer than we've synced with)
        const clients = Object.entries(masterIndex.clients).filter(([clientID, client]) => {
            const previous = clientStates.find((s) => s.clientID === clientID);
            return !previous || !previous.lastReceived || previous.lastReceived < client.lastReceived;
        }).map((v) => v[0]);

        // completed network operations
        let completed = 1;
        // total operations, includes fetch of getMasterIndex
        const total = 1 + clients.length;
        logProgress(0.5 * (completed / total));
        // fetch client indexes for those clients in parallel
        // note: we download only a subset of client indexes here, even though the master index may be out of date
        // (mid-update) because it would slow us down a lot and it should fix itself on the next sync.
        const clientIndexes =
            await Promise.all(clients.map(
                (clientID) => this.getClientIndex(document.getID(), clientID)
                .then((res) => {
                    logProgress(0.5 * (++completed / total));
                    return res;
                })
            ));
        logProgress(0.5);

        return this.mergeClients(document, clientIndexes, undefined,
            // second part = remaining 50% of work
            (completion: number) => logProgress(0.5 + 0.5 * completion));
    }

    /**
     * Merge changes from other users
     * @param document The document to merge changes into (this is modified by this operation!)
     * @param onProgress A function called to indicate progress of this operation (optional).
     * @return The document after the changes are applied to it
     */
    public async mergeFromRemotePeers(
        document: Document,
        onProgress: ProgressFunction = defaultProgress
    ): Promise<Document> {
        this.logger.debug(`mergeFromRemotePeers - merging into document ${document.getID()}...`);
        const logProgress = (p: number) => {
            this.logger.debug(`mergeFromRemotePeers - ${Math.round(p * 100)}%`);
            onProgress(p);
        };
        const myMasterIndex = await this.getMasterIndex(document.getID());

        let completed = 1; // 1 = fetch of master index
        let total = (1 + myMasterIndex.peers.length);
        logProgress(0.25 * (completed / total)); // first part = 25% of work
        // construct the list of peers to obtain changes from (from masterindex)
        // filter to those peers we need to sync with (are newer than we've synced with)
        // and can sync with (actually responds when we try to fetch their master index)
        const peers: MasterIndex[] = (await Promise.all(myMasterIndex.peers.map((peer) => {
            if (!peer.url) return null;
            return this.getRemoteFile(peer.url, this.allStores)
                .then((file) => parseJsonAs(file, ObjectDataType.MasterIndex) as MasterIndex)
                .then((theirMasterIndex) => {
                    // have we already seen this version, then ignore it, otherwise sync with it
                    return document.isNewerThan(theirMasterIndex.latestUpdate!) ? null : theirMasterIndex;
                })
                .then((res) => {
                    logProgress(0.25 * (++completed / total));
                    return res;
                })
                .catch(this.errorAsNull); // ignore any master index we couldn't fetch
        }))).filter((s) => !!s) as MasterIndex[]; // remove nulls

        completed = 0;
        total = peers.length + 1; // include merge operation
        logProgress(0.25 + 0.25 * (completed / total)); // second part = 25% of work
        // for every peer, obtain the client index for the latest updated client of that peer
        // (this should already contain the clientState of the clients we know)
        // as well as the parts files and merge them into the document
        const clientIndexes: ClientIndex[] = (await Promise.all(peers.map((peer) => {
            const client = peer.clients[peer.latestUpdate!.clientID];
            return this.getRemoteFile(client.url, this.allStores)
                .then((file) => {
                    logProgress(0.25 + 0.25 * (completed / total));
                    return parseJsonAs(file, ObjectDataType.ClientIndex) as ClientIndex;
                })
                .catch(this.errorAsNull); // ignore any client index we couldn't fetch
        }))).filter((s) => !!s) as ClientIndex[]; // remove nulls
        logProgress(0.5);

        return this.mergeClients(document, clientIndexes, this.allStores,
            // last part = remaining 50% of work
            (completion: number) => { logProgress(0.5 + 0.5 * completion); });
    }

    public getMasterIndex(documentID: ObjectID): Promise<MasterIndex> {
        return this.store.getFile({
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
     * @param onProgress A function called to indicate progress of this operation (optional).
     * @return The document with the merged changes
     */
    public async mergeClients(
        document: Document,
        clientIndexes: ClientIndex[],
        stores: RemoteStore[] = [this.store],
        onProgress: ProgressFunction = defaultProgress
    ): Promise<Document> {
        this.logger.debug(`mergeClients - merging into document ${document.getID()}...`);
        const clientStates = document.getClientStates();

        let completedClients = 0;
        const total = clientIndexes.length + 1; // include merge changes operation

        const changes = await Promise.all(clientIndexes.map(async (clientIndex) => {
            try {
                const previous = clientStates.find((s) => s.clientID === clientIndex.clientID);
                const parts =
                    clientIndex.parts.filter(
                        (part) => (!previous || !previous.lastReceived || previous.lastReceived < part.toVersion!)
                    );
                let completedParts = 0;
                const files = await Promise.all(
                    // fetch in parallel
                    parts.map((part) => part.url && this.getRemoteFile(part.url, stores).then(JSON.parse)
                        .then((res) => {
                            onProgress((completedClients + (++completedParts / parts.length)) / total);
                            return res;
                        }))
                ).then(values => values.filter(f => f));
                onProgress(++completedClients / total);
                // for this client, we must merge these change parts
                return {
                    clientIndex,
                    parts: files
                };
            } catch (e) {
                return this.errorAsNull(e as Error); // for any error, skip this client
            }
        }));

        // merge all the parts into the document, sequentially by client, and then by part
        for (const change of changes) {
            if (!change) continue;
            this.logger.debug(
                `mergeClients - merging from client ${change.clientIndex.clientID} into document ${document.getID()}`);
            for (const part of change.parts) {
                document.applyChanges(part);
            }
        }
        this.logger.debug(`mergeClients - done merging into document ${document.getID()}`);

        return document;
    }

    public getClientIndex(documentID: ObjectID, clientID: ClientID): Promise<ClientIndex> {
        return this.store.getFile({
            path: pathFor(documentID, clientID),
            fileName: "client-index.json"
        }).then((file) =>
            parseJsonAs(file, ObjectDataType.ClientIndex) as ClientIndex);
    }

    public getRemoteFile(url: string, stores: RemoteStore[]): Promise<string> {
        return Promise.all(
            stores.map(async (store) => {
                if (await store.canDownloadUrl(url)) {
                    return store;
                }
                return null;
            })
        ).then(stores => stores.filter(s => !!s))
         .then(stores => {
            if (stores[0]) {
                return stores[0].downloadUrl(url)
            } else {
                return Promise.reject(new Error("no compatible store"));
            }
        });
    }

    private updateMasterIndex(
        document: Document, clientIndex: ClientIndex, clientIndexUrl: string, store: RemoteStore
    ): Promise<MasterIndex> {
        return this.getMasterIndex(document.getID())
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

    private errorAsNull(e: Error): null {
        this.logger.error(e);
        return null;
    }

}

interface ClientData {
    clientIndex: ClientIndex;
    parts: string[];
}

interface SaveRemoteOptions {
    /** human-readable name of the client doing the syncing */
    clientName ?: string;
    /** soft limit for the maximum size in bytes of a part saved to a remote store */
    partSizeLimit ?: number;
    /**
     * A progress function called to indicate completion while executing.
     * It is called with a parameter from 0 to 1.
     */
    onProgress?: ProgressFunction;
}

function defaultProgress(completion: number) { /* do nothing */ }

function fileKnownAs(json: any, dataType: ObjectDataType): boolean {
    return (json && json._minisync && (json._minisync.dataType === dataType));
}

function parseJsonAs<T>(file: FileData|string|null, dataType: ObjectDataType): T|null {
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
            [...handle.path, handle.fileName].filter((s: any) => s).join("/")) +
        (message ? ": " + message : ""));
}

function newClientIndex(clientID: ClientID, clientName?: string): ClientIndex {
    return {
        _minisync: {
            dataType: ObjectDataType.ClientIndex,
            version: 1
        },
        latest: '',
        updated: '',
        clientID,
        clientName: clientName ?? '',
        parts: []
    };
}

function newMasterIndex(document: Document): MasterIndex {
    return {
        _minisync: {
            dataType: ObjectDataType.MasterIndex,
            version: 1
        },
        label: '',
        clients: {},
        peers: [],
        latestUpdate: null,
        url: null
    };
}

function documentFromClientData(
    changes: ClientData, forClientID ?: ObjectID, fromPeer ?: Peer
): Document {
    const parts = changes.parts.slice();
    if (parts.length) {
        const document = new Document(
            JSON.parse(parts.shift()!), changes.clientIndex.clientID === forClientID);
        for (const part of parts) {
            document.applyChanges(JSON.parse(part));
        }
        if (fromPeer) document.addPeer(fromPeer);
        return document;
    }
    throw new Error("unable to restore documents, no changes data to restore from");
}
