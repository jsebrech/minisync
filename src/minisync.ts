import * as base64 from "./base64";
import {ChangesObject, Document} from "./document";
import {Syncable, SyncableArray} from "./syncable";
import {ClientID, dateToString} from "./types";
import * as uid from "./uid";

// TODO: P2P communication mechanism (default implementation)

// TODO: events for remote changes

// Public API

export function from (data: ChangesObject | any, restore?: boolean): Document {
    return new Document(data || {}, restore);
}

export function createID(): ClientID {
    return uid.next();
}

export function restore(data: ChangesObject | any): Document {
  return new Document(data || {}, true);
}

// Private API exposed for unit tests only

export let _private = {
    nextVersion: base64.nextVersion,
    dateToString,
    createLongID: uid.nextLong,
    Syncable,
    SyncableArray
};
