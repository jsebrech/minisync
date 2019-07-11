import { Document } from "../document";
import { ClientID, dateToString, ObjectDataType, ObjectID, padStr } from "../types";
import { ClientIndex, FileData, FileHandle, MasterIndex, RemoteStore } from "./types";

// TODO: publish/subscribe document from remoteStore

// remote syncing API

// 1 MB
const PART_SIZE_LIMIT = 1024 * 1024;

interface SaveRemoteOptions {
    /** human-readable name of the client doing the syncing */
    clientName ?: string;
    /** soft limit for the maximum size in bytes of a part saved to a remote store */
    partSizeLimit ?: number;
}

export function saveRemote(document: Document, store: RemoteStore, options?: SaveRemoteOptions): Promise<ClientIndex> {
    // what have we stored before?
    return getClientIndex(document.getID(), document.getClientID(), store)
        .then((clientIndex: ClientIndex) => {
            if (!options) options = {};
            // if we've never written to this store for this client, create a fresh client index
            if (!clientIndex) {
                clientIndex = newClientIndex(document.getClientID(), options.clientName);
            }
            // determine part to write to (append latest or start new)
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
            // write changes to part file, if necessary
            if (!writeToPart.fromVersion || (document.getDocVersion() > writeToPart.toVersion)) {
                writeToPart.toVersion = document.getDocVersion();
                const data = document.getChanges(writeToPart.fromVersion);
                const dataStr = JSON.stringify(data);
                writeToPart.size = dataStr.length;
                return store.putFile({
                    path: pathFor(document.getID(), document.getClientID()),
                    fileName: "part-" + padStr(String(writeToPart.id), 8),
                    contents: dataStr
                }).then((success) => {
                    clientIndex.latest = writeToPart.toVersion;
                    clientIndex.updated = dateToString(new Date());
                    if (options.clientName) clientIndex.clientName = options.clientName;
                    return store.putFile({
                        path: pathFor(document.getID(), clientIndex.clientID),
                        fileName: "client-index.json",
                        contents: JSON.stringify(clientIndex)
                    }).then(
                        () => updateMasterIndex(document, clientIndex, store)
                     ).then(() => clientIndex);
                });
            } else return clientIndex;
        });
}

export function restoreRemote(documentID: ObjectID, store: RemoteStore): Promise<Document> {
    return null;
}

export function getMasterIndex(documentID: ObjectID, store: RemoteStore): Promise<MasterIndex> {
    return store.getFile({
        path: pathFor(documentID),
        fileName: "master-index.json"
    }).then((file) =>
        parseJsonAs(file, ObjectDataType.MasterIndex) as MasterIndex);
}

function updateMasterIndex(document: Document, clientIndex: ClientIndex, store: RemoteStore): Promise<MasterIndex> {
    return getMasterIndex(document.getID(), store)
        .then((masterIndex) => {
            // if we've never written to this store for this client, create a fresh client index
            if (!masterIndex) {
                masterIndex = newMasterIndex(document);
            }
            // update this client's info in the master index
            masterIndex.clients[clientIndex.clientID] = {
                url: null, // TODO: set url
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
