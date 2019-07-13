import { Document } from "../document";
import { ClientID, dateToString, ObjectDataType, ObjectID, padStr } from "../types";
import { ClientIndex, FileData, FileHandle, MasterIndex, RemoteStore } from "./types";

// remote syncing API

// 1 MB
const PART_SIZE_LIMIT = 1024 * 1024;

interface SaveRemoteOptions {
    /** human-readable name of the client doing the syncing */
    clientName ?: string;
    /** soft limit for the maximum size in bytes of a part saved to a remote store */
    partSizeLimit ?: number;
}

/**
 * Saves a document to a remote store for the current client
 * @param document The document to save
 * @param store The remote store to save to
 * @param options Additional configuration options
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
export function saveRemote(document: Document, store: RemoteStore, options?: SaveRemoteOptions): Promise<ClientIndex> {
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
            if (writeToPart.size > (options.partSizeLimit || PART_SIZE_LIMIT)) {
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
                }).then(
                    (handle) => store.publishFile(handle)
                ).then((publishedUrl) => {
                    writeToPart.url = publishedUrl;
                    // update the client index and master index
                    clientIndex.latest = writeToPart.toVersion;
                    clientIndex.updated = dateToString(new Date());
                    if (options.clientName) clientIndex.clientName = options.clientName;
                    return store.putFile({
                        path: pathFor(document.getID(), clientIndex.clientID),
                        fileName: "client-index.json",
                        contents: JSON.stringify(clientIndex)
                    }).then(
                        (handle) => store.publishFile(handle)
                    ).then(
                        (url) => updateMasterIndex(document, clientIndex, url, store)
                    ).then(() => clientIndex);
                });
            } else return clientIndex;
        });
}

/**
 * Create a document by restoring it from the latest version in a store
 * @param documentID The document's ID
 * @param store The remote store to fetch it from
 */
export function createFromRemote(documentID: Document, store: RemoteStore): Promise<Document> {
    // TODO: implement createFromRemote

    return Promise.reject(new Error("not yet implemented"));
}

/**
 * Merge changes from this user's other clients in a remote store
 * @param document The documet to merge changes into
 * @param store The store to merge changes from
 * @return The document with the changes applied to it
 */
export function mergeFromRemoteClients(document: Document, store: RemoteStore): Promise<Document> {
    // TODO: implement mergeFromRemoteClients

    // get master index to find a list of our clients

    // filter to those clients we need to sync with (are newer than we've synced with)

    // for every client, obtain the parts files and merge them into the document

    // update the list of peers in the document

    return Promise.reject(new Error("not yet implemented"));
}

/**
 * Merge changes from other users
 * @param document The document to merge changes into
 * @param allStores All stores that can be used to download changes from other users
 */
export function mergeFromRemotePeers(
    document: Document, allStores: RemoteStore[]
): Promise<Document> {
    // TODO: implement mergeFromRemotePeers

    // construct the list of peers to obtain changes from

    // filter to those peers we need to sync with (are newer than we've synced with)

    // for every peer, obtain the parts files and merge them into the document

    return Promise.reject(new Error("not yet implemented"));
}

export function getMasterIndex(documentID: ObjectID, store: RemoteStore): Promise<MasterIndex> {
    return store.getFile({
        path: pathFor(documentID),
        fileName: "master-index.json"
    }).then((file) =>
        parseJsonAs(file, ObjectDataType.MasterIndex) as MasterIndex);
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
                version: clientIndex.latest,
                label: clientIndex.clientName
            };
            masterIndex.latestUpdate = clientIndex.clientID;
            return store.putFile({
                path: pathFor(document.getID()),
                fileName: "master-index.json",
                contents: JSON.stringify(masterIndex)
            }).then(() => masterIndex);
        });
}

export function getClientIndex(documentID: ObjectID, clientID: ClientID, store: RemoteStore): Promise<ClientIndex> {
    return store.getFile({
        path: pathFor(documentID, clientID),
        fileName: "client-index.json"
    }).then((file) =>
        parseJsonAs(file, ObjectDataType.ClientIndex) as ClientIndex);
}

function fileKnownAs(json: any, dataType: ObjectDataType): boolean {
    return (json && json._minisync && (json._minisync.dataType === dataType));
}

function parseJsonAs(file: FileData, dataType: ObjectDataType) {
    if (file === null) return null;
    const result = JSON.parse(file.contents);
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
    return result;
}

function pathFor(documentID: ObjectID, clientID?: ClientID): string[] {
    const path = ["documents", "document-" + documentID];
    if (clientID) {
        path.push("client-" + clientID);
    }
    return path;
}

function errorFor(handle: FileHandle, message: string): Error {
    return new Error("Error at " +
        handle.path.concat(handle.fileName).filter((s: any) => s).join("/") +
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
        peers: {},
        latestUpdate: null
    };
}
