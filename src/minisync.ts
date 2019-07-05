import * as base64 from "./base64";
import {Document} from "./document";
import {Syncable, SyncableArray} from "./syncable";
import {ChangesObject, ClientID, dateToString} from "./types";
import * as uid from "./uid";

// TODO: P2P communication mechanism (default implementation)

// Public API

/**
 * Create a minisync Document from a raw object or minisync changes object (bootstraps a new client)
 * @param data The changes object to reconstruct from, or the raw object to create a new Document for
 * @param restore For changes objects, if true retores the Document to memory (as the client that exported the changes)
 * @return The minisync Document
 */
export function from(data?: ChangesObject | any, restore?: boolean): Document {
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
 * Restore a Document from a changes object (as the client that created it)
 * @param data A complete changes object generated with document.getChanges
 * @return The minisync Document
 */
export function restore(data: ChangesObject): Document {
  return from(data, true);
}
