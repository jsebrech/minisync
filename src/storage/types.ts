import { ChangesObjectVersion, ClientID, Timestamp, Version } from "../types";

/**
 * A descriptor for a file in a store
 */
export interface FileHandle {
    /** when joined with a separator this array makes a folder path */
    path: string[];
    /** the filename inside the path that the file is stored as */
    fileName: string;
}
/**
 * The data and metadata for a file in a store
 */
export interface FileData extends FileHandle {
    contents: string;
}

/**
 * All storage plugins must implement this API.
 *
 * It implements a basic async files and folders API
 * that should be mappable to local and remote storage API's.
 *
 * Stores that only implement this API can be used only for saving data private to an individual client,
 * and cannot be used to share data between clients.
 */
export interface Store {
    /** Upload a file to a store (privately) */
    putFile(file: FileData): Promise<FileHandle>;
    /** Download a file from a store, returns null if no such file exists */
    getFile(file: FileHandle): Promise<FileData>;
    /** List the files in a store's folder */
    listFiles(path: string[]): Promise<FileHandle[]>;
}

/**
 * Storage plugins that are able to share files on the internet
 * should implement this API instead. Only RemoteStore instances
 * can be used to share minisync documents between clients of the same user,
 * and with clients of other users.
 */
export interface RemoteStore extends Store {
    /** Create a public URL for a file */
    publishFile(file: FileHandle): Promise<string>;
    /** Detects whether the given URL can be downloaded by this store */
    canDownloadUrl(url: string): boolean;
    /** Downloads the given URL and returns the enclosed data */
    downloadUrl(url: string): Promise<string>;
}

/** Description of a remote client */
export interface RemoteClient {
    /** URL to the master index of that client */
    url: string;
    /** The version we've last seen of this client */
    version: Version;
    /** Humna-visible description of this client */
    label ?: string;
}

/** Group of remote client descriptions, indexed by client id */
export interface RemoteClients {
    [key: string]: RemoteClient;
}

/**
 * Master index of all client representations of a document, as kept in a remote store
 */
export interface MasterIndex {
    /** file format identifier */
    _minisync: ChangesObjectVersion;
    /** Human-visible description of this peer */
    label: string;
    /** List of all the cclients of this peer */
    clients: RemoteClients;
    /** List of all the other peers' clients this peer knows */
    peers: RemoteClients;
    /** This file was last updated by this client */
    latestUpdate: ClientID;
}

/**
 * Client index of parts belonging to a particular client in a remote store
 */
export interface ClientIndex {
    /** file format identifier */
    _minisync: ChangesObjectVersion;
    /** version that was last saved for this client */
    latest: Version;
    /** timestamp that the last save occurred (ISO) */
    updated: Timestamp;
    /** ID of the client that owns this folder */
    clientID: ClientID;
    /** user-readable description of the client */
    clientName: string;
    /** the data parts that are saved for this client */
    parts: ClientIndexPart[];
}

export interface ClientIndexPart {
    /** unique identifier of the part, in ascending order */
    id: number;
    /* contains the data starting from this version */
    fromVersion: Version;
    /* ends at this version */
    toVersion: Version;
    /** url for remote download of the part */
    url: string;
    /** size in bytes (indicative) */
    size: number;
}
