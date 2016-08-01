export type Version = string;
export type ClientID = string;
export type ObjectID = string;

/**
 * Returns true if the given parameter is an Array
 * @param v
 * @returns {boolean}
 */
export function isArray(v: any): boolean {
    return Object.prototype.toString.call(v) === "[object Array]";
};

/**
 * Return a date string which can be compared using < and >
 * @param {Date} [date]
 * @returns {String}
 */
export function dateToString(date: Date): string {
    if (!(date instanceof Date)) date = new Date();
    return padStr(date.getUTCFullYear().toString(), 4) +
           padStr((date.getUTCMonth() + 1).toString(), 2) +
           padStr(date.getUTCDate().toString(), 2) +
           padStr(date.getUTCHours().toString(), 2) +
           padStr(date.getUTCMinutes().toString(), 2) +
           padStr(date.getUTCSeconds().toString(), 2);
};

/**
 * Left-pad a string to the desired length with zeroes
 * @param arg
 * @param {int} length
 * @returns {string}
 */
export function padStr(arg: string, length: number): string {
    let str: string = String(arg);
    while (str.length < length) str = "0" + str;
    return str;
}

/**
 * Which versions of the documet a remote client is aware of
 */
export interface ClientState {
    /** ID of the remote client */
    clientID: ClientID;
    /** Which version of us was last acknowledged as received by them */
    lastAcknowledged: Version;
    /** Which version of them was last received by us */
    lastReceived: Version;
}

/** State of a Syncable object, array or Document */
export interface State {
    /** Unique id of this object as known to all peers */
    id: ObjectID;
    /** version of last update */
    u: Version;
    /** timestamp of last change (iso string) */
    t: Version;
    /** removed in version */
    r?: Version;
    /** true if this is the state for an array */
    a?: boolean;
    /** for arrays, list of removed objects */
    ri?: Array<ArrayRemovedObject>;
    /** only for Document, the document-level version */
    v?: Version;
    /** only for Document, the client id for the local client managing the document */
    clientID?: ClientID;
    /** only for Document, version-tracking for the versions known by remote clients */
    remote?: Array<ClientState>;
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
