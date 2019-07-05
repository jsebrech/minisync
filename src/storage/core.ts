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
 *
 * It implements a basic async files and folders API
 * that should be mappable to local and remote storage API's.
 */
export interface Store {
    /** Upload a file to a store (privately) */
    putFile(file: FileData): Promise<boolean>;
    /** Download a file from a store */
    getFile(file: FileHandle): Promise<FileData>;
    /** List the files in a store's folder */
    listFiles(path: string[]): Promise<FileHandle[]>;
}

/**
 * Storage plugins that are able to share files on the internet
 * should implement this API instead. Only RemoteStore instances
 * can be used to share minisync documents with others
 */
export interface RemoteStore extends Store {
    /** Create a public URL for a file */
    publishFile(file: FileHandle): Promise<string>;
    /** Detects whether the given URL can be downloaded by this store */
    canDownloadUrl(url: string): boolean;
    /** Downloads the given URL and returns the enclosed data */
    downloadUrl(url: string): Promise<string>;
}

/**
 * Save a document to a local store
 * @param document Document to aave
 * @param store The store to save to
 * @return The document's ID (to restore from)
 */
export function saveLocal(document: Document, store: Store): Promise<ObjectID> {
    return store.putFile({
        path: ["documents"],
        fileName: document.getID() + ".json",
        contents: JSON.stringify(document.getChanges())
    }).then((success: boolean) => {
        if (!success) throw new Error("Unexpected error saving document");
        return document.getID();
    });
}

/**
 * Restore a document from a local store
 * @param id The document id to restore
 * @param store The store to restore from
 * @return The restored document
 */
export function restoreLocal(id: ObjectID, store: Store): Promise<Document> {
    return store.getFile({
        path: ["documents"],
        fileName: id + ".json"
    }).then((data: FileData) => {
        return minisync.restore(JSON.parse(data.contents));
    });
}

// TODO: publish/subscribe document from remoteStore
