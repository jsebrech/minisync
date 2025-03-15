export type Version = string;
export type ClientID = string;
export type ObjectID = string;
export type Timestamp = string;
export type Proxy = any;

/**
 * Return a date string which can be compared using < and >
 * @param {Date} [date]
 * @returns {String}
 */
export function dateToString(date: Date): Timestamp {
    if (!(date instanceof Date)) date = new Date();
    return date.getUTCFullYear().toString().padStart(4, '0') +
           (date.getUTCMonth() + 1).toString().padStart(2, '0') +
           date.getUTCDate().toString().padStart(2, '0') +
           date.getUTCHours().toString().padStart(2, '0') +
           date.getUTCMinutes().toString().padStart(2, '0') +
           date.getUTCSeconds().toString().padStart(2, '0');
}

/**
 * Which versions of the documet a remote client is aware of
 */
export interface ClientState {
    /** ID of the remote client */
    clientID: ClientID;
    /** Which version of us was last acknowledged as received by them, undefined if no such version */
    lastAcknowledged?: Version;
    /** Which version of them was last received by us, undefined if no such version */
    lastReceived?: Version;
}

export interface LatestUpdate {
    /** the client ID for a client latest update info (something we have or will sync with) */
    clientID: ClientID;
    /** the timestamp that latest update was generated */
    updated: Timestamp;
    /** the version of that latest update */
    version: Version;
}

/** Description of a peer (user that shares a document) */
export interface Peer {
    /** URL to the master index of that peer */
    url: string|null;
    /** The metadata for the last sync with this peer */
    latestUpdate: LatestUpdate|null;
    /** Human-visible description of this peer (copied from their master index) */
    label: string;
}

/** State of a Syncable object, array or Document */
export interface State {
    /** Unique id of this object as known to all peers */
    id: ObjectID;
    /** version of last update */
    u: Version;
    /** timestamp of last change (iso string) */
    t: Timestamp;
    /** removed in version */
    r?: Version;
    /** true if this is the state for an array */
    a?: boolean;
    /** for arrays, list of removed objects */
    ri?: ArrayRemovedObject[];
}

export interface DocumentState extends State {
    /** the document-level version */
    v?: Version;
    /** the client id for the local client managing the document */
    clientID?: ClientID;
    /** version-tracking for the versions known by remote clients */
    remote?: ClientState[];
    /** list of known peers we sync with */
    peers?: Peer[];
}

export interface ArrayRemovedObject {
    id: string; // object with this state object id
    r: string; // was removed in this version
}

export interface AnyWithState {
    [index: string]: any;
    _s: State;
}

export interface ArrayWithState extends Array<any> {
    _s: State;
}

export type AnyValue = AnyWithState | ArrayWithState | any;

/**
 * JSON object that carries document changes between clients
 */
export interface ChangesObject {
    /** Allows identifying this as a ChangesObject when untyped */
    _minisync: ChangesObjectVersion;
    /** the document this is a changes object for */
    documentID: ObjectID;
    /** Which client sent these changes */
    sentBy: ClientID;
    /** The client's version the changes were taken from */
    fromVersion: Version;
    /** The state of all peers as known to that client */
    clientStates: ClientState[];
    /** The version starting from which changes are reported, null if starting from the beginning */
    changesSince: Version|null;
    /** The changes themselves */
    changes: AnyWithState|null;
}

export const enum ObjectDataType {
    // a changes object
    Changes = "CHANGES",
    // a master index in a remote store (index of all clients)
    MasterIndex = "MASTER-INDEX",
    // a client index in a remote store (index of file parts for one client)
    ClientIndex = "CLIENT-INDEX"
}

export interface ChangesObjectVersion {
    dataType: ObjectDataType;
    /** format version, for future compatibility */
    version: number;
}
