import {Document} from "../document";
import * as minisync from "../minisync";
import {ObjectID} from "../types";

export interface FileHandle {
    /** when joined with a separator this array makes a folder path */
    path: string[];
    /** the filename inside the path that the file is stored as */
    fileName: string;
}
export interface FileData extends FileHandle {
    contents: string;
}

/**
 * All storage plugins must implement this API.
 */
export interface Store {
    putFile(file: FileData): Promise<boolean>;
    getFile(file: FileHandle): Promise<FileData>;
    getFiles(files: FileHandle[]): Promise<FileData[]>;
    listFiles(path: string[]): Promise<FileHandle[]>;
}

/**
 * Save a document to a store
 * @param document Document to aave
 * @param store The store to save to
 * @return The document's ID (to restore from)
 */
export function save(document: Document, store: Store): Promise<ObjectID> {
    return store.putFile({
        path: ["documents"],
        fileName: document.getID(),
        contents: JSON.stringify(document.getChanges())
    }).then((success: boolean) => {
        if (!success) throw new Error("Unexpected error saving document");
        return document.getID();
    });
}

/**
 * Restore a document from local storage
 * @param id The document id to restore
 * @param store The store to restore from
 * @return The restored document
 */
export function restore(id: ObjectID, store: Store): Promise<Document> {
    return store.getFile({
        path: ["documents"],
        fileName: id
    }).then((data: FileData) => {
        return minisync.restore(JSON.parse(data.contents));
    });
}

// TODO: implement dropbox plugin
// TODO: publish/subscribe document from remoteStore
