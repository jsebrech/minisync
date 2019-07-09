import { ClientID, ObjectDataType, ObjectID } from "../types";
import { ClientIndex, FileData, FileHandle, MasterIndex, RemoteStore } from "./types";

// TODO: publish/subscribe document from remoteStore

// remote synccing API

export function saveRemote(document: Document, store: RemoteStore): Promise<ObjectID> {
    return null;
}

export function restoreRemote(id: ObjectID, store: RemoteStore): Promise<Document> {
    return null;
}

export function getMasterIndex(documentID: ObjectID, store: RemoteStore): Promise<MasterIndex> {
    return store.getFile({
        path: pathFor(documentID),
        fileName: "master-index.json"
    }).then((file) =>
        parseJsonAs(file, ObjectDataType.MasterIndex) as MasterIndex);
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
    const result = JSON.parse(file.contents);
    if (!fileKnownAs(result, dataType)) {
        switch (dataType) {
            case ObjectDataType.ClientIndex:
                throw errorFor(file, "not a client index file");
            case ObjectDataType.MasterIndex:
                throw errorFor(file, "not a master index file");
            default:
                throw errorFor(file, "unrecognied type: " + dataType);
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
