import * as base64 from "./base64";
import {ChangesObject, Document} from "./document";
import {Syncable, SyncableArray} from "./syncable";
import {ClientID, dateToString} from "./types";
import * as uid from "./uid";

// TODO: P2P communication mechanism (default implementation)

// Public API

/**
 * Create a minisync Document from a data object or minisync changes object (bootstraps a new client)
 * @param data The changes object to reconstruct from
 * @param restore 
 * @return The minisync Document
 */
export function from (data: ChangesObject | any, restore?: boolean): Document {
    return new Document(data || {}, restore);
}

/**
 * Create a unique client identifier.
 * @return The client identifier
 */
export function createID(): ClientID {
    return uid.next();
}

/**
 * Reconstruct the client state of the client that creates a changes object
 * @param data A changes object generated with document.getChanges
 * @return The minisync Document
 */
export function restore(data: ChangesObject): Document {
  return from(data, true);
}

// Private API exposed for unit tests only

export let _private = {
    nextVersion: base64.nextVersion,
    dateToString,
    createLongID: uid.nextLong,
    Syncable,
    SyncableArray
};
