import {Syncable, SyncableArray} from "./syncable";
import Document from "./document";
import ChangesObject from "./document";
import {dateToString, ClientID} from "./types";
import * as uid from "./uid";
import * as base64 from "./base64";

// TODO: P2P communication mechanism (default implementation)

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

export var _private = {
    nextVersion: base64.nextVersion,
    dateToString: dateToString,
    createLongID: uid.nextLong,
    Syncable: Syncable,
    SyncableArray: SyncableArray
};
