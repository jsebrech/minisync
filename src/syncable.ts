import { isNewerVersion } from "./base64";
import {Document} from "./document";
import {
    AnyValue, AnyWithState, ArrayRemovedObject, ArrayWithState,
    ClientState, dateToString, isArray, ObjectID, State, Version
} from "./types";
import * as uid from "./uid";

/**
 * JSON object wrapper which tracks changes inside the JSON object
 */
export class Syncable {

    // the Document this Syncable exists in
    protected document: Document;
    // the data this Syncable wraps
    protected data: AnyWithState;
    // the proxy object created for this Syncable
    protected proxy: any;

    /**
     * Syncable class constructor, wraps one synchronizing object in a document
     * @param document The master document this is linked to
     * @param data The data object it wraps
     * @param restore True if restoring from changes object
     */
    constructor(document?: Document, data?: Object | any[], restore?: boolean) {
        if (document) this.setDocument(document);
        if (data) this.setData(data, restore);
    }

    /**
     * Return the raw data object inside this Syncable
     * Is recursive, so the data object returned contains only the raw data
     * @returns {Object|Array|Number|String|Boolean}
     */
    public getData(): any {
        if (this.isRemoved()) return null;
        let result: any = this.data;
        if (typeof this.data === "object") {
            result = {};
            for (let i in this.data) {
                if (this.data.hasOwnProperty(i) && (i !== "_s")) {
                    let v = makeSyncable(this.document, this.data[i]);
                    if (v instanceof Syncable) {
                        if (v.isRemoved()) continue;
                        result[i] = v.getData();
                    } else {
                        result[i] = v;
                    }
                }
            }
        }
        if (result && result._s) delete result._s;
        return result;
    }

    /**
     * Return the internal data object, without converting back to normal form
     * @returns {*}
     * @internal
     */
    public getInternalData(): any {
        return this.data;
    }

    /**
     * Return the minisync state object tied to this data object
     * Properties:
     * - id: string,
     * - t: string, timestamp of last change
     * - u:string (last updated in version)
     * - r: string (removed in version)
     * - ri: array (for SyncableArray, [{id: string, r: string}]
     *              = removed item id's and version they were removed)
     * @returns {*}
     */
    public getState(): State {
        if (!this.data) throw "data property not set";
        if (!this.data._s) {
            if (!this.document) throw "document property not set";
            let s: State = {
                id: uid.next(),
                u: null,
                t: dateToString(new Date())
            };
            this.data._s = s; // getDocVersion needs the _s
            s.u = this.document.getDocVersion();
        }
        return this.data._s;
    }

    /**
     * Update the internal state object
     * @returns {{id: string}|*|{id: *, u: string}}
     */
    public updateState(): State {
        let state = this.getState();
        state.u = this.document.nextDocVersion();
        state.t = dateToString(new Date());
        return state;
    }

    /**
     * Return the unique id of this object
     * @returns {String}
     */
    public getID(): string {
        return this.getState().id;
    }

    /**
     * Return the version the properties on this object were last updated
     * @returns {string}
     */
    public getVersion(): Version {
        return this.getState().u;
    }

    /**
     * Return the timestamp this object was last updated
     * @returns {String}
     */
    public getTimeStamp(): string {
        return this.getState().t;
    }

    /**
     * Return a proxy object for the wrapped object that keeps track of changes
     * You still have to synchronize through the original Document object
     * @returns {any}
     */
    public getProxy(): any {
        let self = this;
        return new Proxy(this.data, {
            get: (target: any, property: string) => {
                if (property === "_s") return undefined;
                let prop = self.get(property);
                if (prop instanceof Syncable) prop = prop.getProxy();
                return prop;
            },
            set: (target: any, property: string, value: any) => {
                return self.set(property, value);
            },
            ownKeys: (target: any) => {
                let keys: string[] = target.getOwnPropertyNames();
                return keys.filter((value: string) => { return value !== "_s"; });
            },
            has: (target: any, property: string) => {
                if (property === "_s") return false;
                return property in target;
            },
            setPrototypeOf: () => {
                throw new Error("setPrototypeOf not supported on minisync objects");
            },
            defineProperty: () => {
                throw new Error("defineProperty not supported on minisync objects");
            },
            deleteProperty: (target: any, property: string) => {
                return this.remove(property);
            }
        });
    }

    /**
     * Set a property on the data object, incrementing the version marker
     * @param key dot-separated property path
     * @param value
     */
    public set(key: string, value: any): boolean {
        // convert Syncable instances back into basic JSON
        value = makeRaw(value);
        let keyParts = String(key).split(".");
        key = keyParts.pop();
        // foo.bar
        if (keyParts.length) {
            return this.get(keyParts.join(".")).set(key, value);
        // foo[2], foo[2][1]
        } else if (key.substr(-1) === "]") {
            let index = key.substr(0, key.length - 1).split("[").pop();
            key = key.split("[").slice(0, -1).join("[");
            return this.get(key).set(index, value);
        // bar, 2
        } else if (!this.isRemoved()) {
            this.data[key] = value;
            this.updateState();
            return true;
        }
        return false;
    }

    /**
     * Get a property from the data object
     * @param key dot-separated property path
     * @param [ifRemoved] also return it if it was removed
     * @returns {Syncable|SyncableArray|any}
     */
    public get(key: string|number, ifRemoved?: boolean): Syncable | SyncableArray | any {
        let keyParts = String(key).split(".");
        key = keyParts.shift();
        let value: Syncable = this;
        // [1], foo[1], foo[1][2]
        if (key.indexOf("[") >= 0) {
            // foo[1], foo[1][2]
            if (key.indexOf("[") > 0) {
                // strip off "foo", keep [1], [1][2]
                value = value.get(key.split("[").shift());
                key = key.substr(key.indexOf("["));
            }
            // copy out last array index
            let index = key.substr(0, key.length - 1).split("[").pop();
            // if there are nested indices (e.g. [1][2])
            if (key.split("[").length > 2) {
                key = key.split("[").slice(0, -1).join("[");
                value = value.get(key);
            }
            key = index;
        }
        value = (value ? value.getInternalData() : null || {})[key];
        value = makeSyncable(this.document, value);
        if (value && keyParts.length) {
            value = value.get(keyParts.join("."));
        }
        // don't return removed values
        if ((value instanceof Syncable) && value.isRemoved() && !ifRemoved) value = null;
        return value;
    }

    /**
     * Remote this object or one of its child properties
     * @return true if the remove was successful
     */
    public remove(key?: string): boolean {
        if (!key) {
            if (!this.isRemoved()) {
                let state = this.getState();
                state.r = this.document.nextDocVersion();
                state.t = dateToString(new Date());
                return true;
            }
        } else {
            let v: any = this.get(key);
            if (v instanceof Syncable) {
                return v.remove();
            } else {
                delete this.data[key];
                this.updateState();
                return true;
            }
        }
    }

    /**
     * Returns the version at which this was removed, if any
     * @returns {String|null}
     */
    public isRemoved(): string {
        return this.data ? this.getState().r : null;
    }

    /**
     * Return a data object with all the changed objects since a version
     * @param version (string)
     * @param [resultSetter] (Function) Function that sets a value on a result object
     * @returns {*} this object and all its changed properties, or null if nothing changed
     */
    public getChangesSince(
        version: Version,
        resultSetter?: (result: AnyWithState, key: string | number, value: any) => void
    ): AnyWithState {
        let result: AnyWithState = null;
        for (let key in this.data) {
            if (this.data.hasOwnProperty(key) && (key !== "_s")) {
                let value = this.get(key, true);
                if (value.getChangesSince) {
                    value = value.getChangesSince(version);
                    if (value !== null) {
                        if (!result) result = this.getChangesResultObject();
                        if (!resultSetter) {
                            result[key] = value;
                        } else {
                            resultSetter(result, key, value);
                        }
                    }
                } else {
                    if (isNewerVersion(this.getVersion(), version)) {
                        if (!result) result = this.getChangesResultObject();
                        if (!resultSetter) {
                            result[key] = value;
                        } else {
                            resultSetter(result, key, value);
                        }
                    }
                }
            }
        }
        return result;
    }

    /**
     * Returns an object containing an empty result object for this value object
     * @protected
     * @returns {{_s: {id: String, u: string, t: String}}}
     */
    public getChangesResultObject(): AnyWithState {
        let result: AnyWithState = {
            _s: {
                id: this.getID(),
                u: this.getVersion(),
                t: this.getTimeStamp()
            }
        };
        if (this.isRemoved()) {
            result._s.r = this.isRemoved();
        }
        return result;
    }

    /**
     * Merge the changes of the remote value object with the local value object
     * @protected
     * @param changes Object containing all the key/value pairs to update
     * @param clientState Client state for the client we're synchronizing from
     */
    public mergeChanges(changes: AnyWithState, clientState: ClientState): void {
        if (!changes) return;
        // if the remote version of the object is newer than the last received
        let otherIsNewer: boolean = ( changes._s &&
            ( isNewerVersion(changes._s.u, clientState.lastReceived) &&
                // and the local data version is older the last local document version
                // that was acknowledged by the remote (no conflict)
                ( !isNewerVersion(this.getVersion(), clientState.lastAcknowledged) ||
                    // or the remote timestamp is not older than the local timestamp
                    // (conflict solved in favor of remote value)
                    (changes._s.t >= this.getTimeStamp())
                )
            )
        );
        let remoteKeys: string[] = Object.keys(changes);
        remoteKeys.forEach((key: string) => {
            if (key === "_s") return;
            let remoteValue: any = changes[key];
            // if primitive value
            // copy remote non-object properties to local object
            if (!remoteValue._s) {
                // if the remote version of the object is newer than the last received
                if ( otherIsNewer &&
                        // and the property value is different from the local value
                    (this.get(key) !== remoteValue) ) {
                    this.set(key, remoteValue);
                }
            // synchronize child objects
            } else {
                let expectType: any = (remoteValue._s.a) ? [] : {};
                if (!sameType(this.get(key), expectType)) {
                    this.set(key, expectType);
                    this.get(key).getState().u = null;
                }
                this.get(key).mergeChanges(remoteValue, clientState);
            }
        }, this);
        if (otherIsNewer) {
            // remove local-only keys (they were removed locally)
            Object.keys(this.getInternalData()).forEach((key: string) => {
                if (remoteKeys.indexOf(key) < 0) {
                    this.remove(key);
                }
            });
        }
        // if the other was removed, remove it here also,
        // even if the local value is newer
        let otherIsRemoved: boolean = !!(changes._s && changes._s.r);
        if (otherIsRemoved) this.remove();
    }

    /**
     * Sets the Document instance inside which this object exists
     * @param document
     */
    protected setDocument(document: Document): void {
        this.document = document;
    }

    /**
     * Sets a new value for this Syncable object
     * @param data
     * @param restore If true, we are restoring from a saved changes object
     */
    protected setData(data: Object | any[], restore?: boolean): void {
        this.data = <AnyWithState> data;
        // make sure the state is initialized in the data object
        if (this.data) {
            this.getState();
            if (restore) {
                for (let key in this.data) {
                    if (this.data.hasOwnProperty(key) && (key !== "_s")) {
                        let value = makeSyncable(this.document, this.data[key], true);
                        if (value instanceof Syncable) {
                            this.data[key] = value.data;
                        }
                    }
                }
            }
        }
    }

}

function makeSyncable(document: Document, data: any, restore?: boolean): Syncable | any;
function makeSyncable(document: Document, data: any[], restore?: boolean): SyncableArray;
function makeSyncable(document: Document, data: Syncable, restore?: boolean): Syncable;
function makeSyncable(document: Document, data: SyncableArray, restore ?: boolean): SyncableArray;
function makeSyncable(document: Document, data: any, restore?: boolean): Syncable | SyncableArray {
    let restoringArray = restore && data && data._s && data._s.a;
    if (isArray(data) || restoringArray) {
        return new SyncableArray(document, data, restore);
    } else if ((typeof data === "object") && !(data instanceof Syncable)) {
        return new Syncable(document, <Object> data, restore);
    } else return data;
}

function makeRaw(data: any): any {
    if (data instanceof Syncable) data = data.getData();
    return data;
}

/**
 * JSON array wrapper which tracks changes inside the JSON array
 */
export class SyncableArray extends Syncable {

    protected data: ArrayWithState;

    /**
     * Syncable Array class constructor, wraps one synchronizing array in a document
     * @param document The master document this is linked to
     * @param data The data array it wraps
     * @param restore Whether we are restoring from a changes object
     * @constructor
     */
    constructor(document: Document, data: SyncableArrayData | any[], restore?: boolean) {
        if (restore) {
            let arrayObj = <SyncableArrayData> data;
            super(document, arrayObj.v, restore);
            this.data._s = arrayObj._s;
        } else {
            if (!isArray(data)) data = [];
            super(document, data, restore);
        }
    }

    /**
     * Overridden getData() for the array subtype
     * Converts the object back into a simple array (no added properties)
     * @returns {Array}
     */
    public getData(): any[] {
        let result: any[] = null;
        if (isArray(this.data)) {
            // make a copy, and recurse
            result = this.data.slice();
            for (let i in result) {
                if (result.hasOwnProperty(i)) {
                    let v: any = makeSyncable(this.document, result[i]);
                    if (v instanceof Syncable) {
                        if (v.isRemoved()) continue;
                        result[i] = v.getData();
                    }
                }
            }
        }
        return result;
    }

    /**
     * Return a data object with all the changed objects since a version
     * @param version (string)
     * @returns {*} this object and all its changed properties, or null if nothing changed
     */
    public getChangesSince(version: Version): AnyWithState {
        return super.getChangesSince(version,
            (result: SyncableArrayData, key: number, value: any): void => {
                result.v[key] = value;
            }
        );
    }

    /**
     * Overridden from parent
     * @returns {{_s: {id: String, u: string, t: String}}}
     */
    public getChangesResultObject(): SyncableArrayData {
        let result: any = super.getChangesResultObject();
        result._s.a = true;
        result.v = [];
        if (this.getRemoved().length) {
            result._s.ri = this.getRemoved();
        }
        return <SyncableArrayData> result;
    }

    /**
     * Overridden from Syncable, merge changes for an array type
     * @param changes
     * @param clientState
     */
    public mergeChanges(changes: SyncableArrayData, clientState: ClientState): void {
        /*
         Assumptions:

         - changes = object with:
         _s: state object
         v: array of values

         - v: complete array, all items from the source client are present
         - v[i] can be primitive or object/array
         - object values may be sparse (don't contain child values)
         */

        if (changes && changes._s && isArray(changes.v)) {
            // remove items that were removed remotely
            if (isArray(changes._s.ri)) {
                changes._s.ri.forEach((removed: ArrayRemovedObject) => {
                    this.forEach((value: Syncable|any, index: number): void => {
                        if (value && value.getID && (value.getID() === removed.id)) {
                            this.splice(index, 1);
                        }
                    }, this);
                }, this);
            }

            // maps value id to index
            let localIDs: IDMap = this.getIdMap();
            let remoteIDs: IDMap = {};

            // synchronize all value objects present in both local and remote
            changes.v.forEach((remoteValue: AnyWithState, remoteIndex: number): void => {
                if (remoteValue && remoteValue._s) {
                    remoteIDs[remoteValue._s.id] = remoteIndex;
                    let localIndex = localIDs[remoteValue._s.id];
                    if (localIndex !== undefined) {
                        let localValue = this.get(localIDs[remoteValue._s.id]);
                        localValue.mergeChanges(remoteValue, clientState);
                    }
                }
            }, this);

            // the remote version of the array is newer than the last received
            let remoteChanged: boolean = isNewerVersion(changes._s.u, clientState.lastReceived);
            if (remoteChanged) {
                let sortedData = this.sortByRemote(changes.v);
                this.data.splice.apply(this.data, [0, this.data.length].concat(sortedData));

                let otherIsNewer: boolean =
                    ( remoteChanged && (
                        // and the local data version is older the last local document version
                        // that was acknowledged by the remote (no conflict)
                        !isNewerVersion(this.getVersion(), clientState.lastAcknowledged) ||
                        // or the remote timestamp is not older than the local timestamp
                        // (conflict solved in favor of remote value)
                        (changes._s.t >= this.getTimeStamp())
                    ));

                let intervals: ValueInterval[] = (() => {
                    let localValue: AnyValue;
                    let remoteValue: AnyValue;
                    // remote values in between objects that exist on both sides
                    let intervals: ValueInterval[] = [];
                    let interval: AnyValue[] = [];
                    let lastID: string = null;
                    let v: any[] = changes.v || [];
                    // synchronize the objects that exist on both sides
                    for (let remoteValue of v) {
                        if (remoteValue && remoteValue._s) {
                            if (localIDs[remoteValue._s.id] !== undefined) {
                                localValue = this.get(localIDs[remoteValue._s.id]);
                                if (interval.length) {
                                    intervals.push({
                                        after: lastID,
                                        before: localValue.getID(),
                                        values: interval
                                    });
                                    interval = [];
                                }
                                lastID = localValue.getID();
                                continue;
                            }
                        }
                        // primitive value or object not occurring in both, remember for next step
                        interval.push(remoteValue);
                    }
                    if (interval.length) intervals.push({
                        after: lastID,
                        before: null,
                        values: interval
                    });
                    return intervals;
                })();

                // synchronize the intervals between the objects that exist on both sides
                if (otherIsNewer) {
                    while (intervals.length) {
                        this.mergeInterval(intervals.shift());
                    }
                }
            }
        }
    }

    /**
     * Sort the local data array based on the sorting order of the remote array
     * Does not update the local data.
     * @param remote Array of remote data
     * @return Array The sorted data
     */
    public sortByRemote(remote: AnyValue[]): AnyValue[] {
        let data = this.data;
        if (!isArray(remote)) return data;
        let localIDs = this.getIdMap();
        // construct map of remote object ID's that also exist locally
        let sharedIDs: string[] = [];
        remote.forEach((remoteValue: AnyValue): void => {
            if (!remoteValue || !remoteValue._s) return;
            if (!localIDs[remoteValue._s.id]) return;
            sharedIDs.push(remoteValue._s.id);
        }, this);
        // split local array into chunks
        let chunks: AnyValue[][] = [];
        let chunk: AnyValue[] = [];
        data.forEach((localValue: AnyValue): void => {
            // if the current value is a shared value, start a new chunk
            if (localValue && localValue._s &&
                (sharedIDs.indexOf(localValue._s.id) >= 0)) {
                chunks.push(chunk);
                chunk = [localValue];
            } else {
                chunk.push(localValue);
            }
        }, this);
        if (chunk.length) chunks.push(chunk);
        // sort chunks by remote order
        chunks.sort((a: AnyValue[], b: AnyValue[]): number => {
            // only the first chunk can be empty, so it always sorts first
            if (!a.length) return -1;
            if (!b.length) return 1;
            let aPos = sharedIDs.indexOf(a[0]._s.id);
            let bPos = sharedIDs.indexOf(b[0]._s.id);
            if (aPos === bPos) return 0;
            return aPos < bPos ? -1 : 1;
        });
        // concatenate chunks
        return Array.prototype.concat.apply([], chunks);
    }

    /**
     * Merge a remote interval (= array of values) into a local range
     * @param {object} interval
     * A range between two syncable objects, null as id to specify array start/end
     * { after: string = id, before: string = id, data: array }
     */
    public mergeInterval(interval: ValueInterval): void {
        let start: number = interval.after ? (this.indexOf(interval.after, 0, true) + 1) : 0;
        let end: number = interval.before ? this.indexOf(interval.before, 0, true) : this.length();
        // take the local range of values corresponding to the interval
        let local: AnyValue[] = this.slice(start, end);
        // take the entire remote range of values
        let values: AnyValue[] = [].concat(interval.values);
        // add all local value objecs and arrays, but not primitives
        local.forEach((value: AnyValue): void => {
            if (value && value._s) values.push(value);
        });
        // replace the local value range by the augmented remote range
        Array.prototype.splice.apply(this.data, [start, end - start].concat(values));
    }

    /**
     * Returns object mapping value object id to index in array where it is found
     * @return object
     */
    public getIdMap(): IDMap {
        let localValue: Syncable;
        // build index mapping local object id's to positions
        let localIDs: IDMap = {};
        for (let i = 0; i < this.length(); i++) {
            localValue = this.get(String(i));
            if (localValue instanceof Syncable) {
                localIDs[localValue.getID()] = i;
            }
        }
        return localIDs;
    }

    /**
     * Remove the item / object at the specified index
     * @param index
     * @result {*} The removed value
     */
    public removeAt(index: number): any {
        let item: AnyValue = makeSyncable(this.document, this.data.splice(index, 1).pop());
        let result: any = makeRaw(item);
        let state: State = this.updateState();
        if (item instanceof Syncable) {
            item.remove();
            if (!isArray(state.ri)) state.ri = [];
            state.ri.push({id: item.getID(), r: state.u});
        }
        return result;
    }

    /**
     * Returns the array of removed object id's
     * @returns {Array}
     */
    public getRemoved(): ArrayRemovedObject[] {
        let state = this.getState();
        return state ? (state.ri || []) : [];
    }

    /**
     * Returns the length of the array
     * @returns {number}
     */
    public length(): number {
        return this.data.length;
    }

    public forEach(callback: any, thisArg: any): void {
        this.data.forEach((value: any, index: number, arr: any[]): void => {
            value = makeSyncable(this.document, value);
            callback.call(thisArg, value, index, arr);
        }, this);
    }

    /**
     * Array.indexOf
     * @param searchElement
     * @param [fromIndex]
     * @param [isObjectID] true if the searchElement is the ID of an object
     * @returns {*}
     */
    public indexOf(searchElement: any, fromIndex: number, isObjectID?: boolean): number {
        if (searchElement instanceof Syncable) {
            searchElement = searchElement.getID();
            isObjectID = true;
        }
        if (isObjectID) {
            for (let i = 0; i < this.data.length; i++) {
                let value = this.get(String(i));
                if (value instanceof Syncable) {
                    if (value.getID() === searchElement) return i;
                }
            }
            return -1;
        } else {
            return this.data.indexOf(searchElement, fromIndex);
        }
    }

    public lastIndexOf(searchElement: any, fromIndex?: number): number {
        if (searchElement instanceof Syncable) {
            searchElement = searchElement.getInternalData();
        }
        return this.data.lastIndexOf(searchElement, fromIndex);
    }

    public pop(): any {
        let item: any = this.data.slice().pop();
        let index: number = this.lastIndexOf(item);
        this.removeAt(index);
        if (item && item._s) delete item._s;
        return item;
    }

    public push(): any {
        this.getState().u = this.document.nextDocVersion();
        return this.data.push.apply(this.data, arguments);
    }

    public reverse(): any {
        this.getState().u = this.document.nextDocVersion();
        this.data.reverse();
        return this;
    }

    public shift(): any {
        if (!this.data || !this.data.length) return null;
        let v = makeRaw(this.get("0"));
        this.removeAt(0);
        return v;
    }

    /**
     * array.splice()
     * @param index position to splice at
     * @param [howMany] number of elements to remove,
     * @param elements The elements to insert
     */
    public splice(index: number, howMany?: number, ...elements: any[]): any {
        let removed: any[] = [];
        while (howMany-- > 0) {
            removed.push(this.removeAt(index));
        }
        while (elements.length > 0) {
            this.data.splice(index, 0, null);
            this.set(String(index), elements.pop());
        }
        return removed;
    }

    /**
     * array.slice()
     * @param begin
     * @param [end]
     * @returns {Array}
     */
    public slice(begin: number, end: number): any[] {
        return this.data.slice(begin, end);
    }

    public unshift(element: any): any {
        this.getState().u = this.document.nextDocVersion();
        return this.data.unshift.apply(this.data, arguments);
    }

    /**
     * Determines whether the specified callback function returns true for any element of an array.
     * @param callbackfn A function that accepts up to three arguments. 
     *        The some method calls the callbackfn function for each element in array1 
     *        until the callbackfn returns true, or until the end of the array.
     * @param thisArg An object to which the this keyword can refer in the callbackfn function. 
     *        If thisArg is omitted, undefined is used as the this value.
     */
    public some(callbackfn: any, thisArg?: any): boolean {
        let data = this.getData();
        return Array.prototype.some.apply(data, arguments);
    }

    /**
     * Calls the specified callback function for all the elements in an array, in descending order. 
     * The return value of the callback function is the accumulated result, 
     * and is provided as an argument in the next call to the callback function.
     * @param callbackfn A function that accepts up to four arguments. 
     * The reduceRight method calls the callbackfn function one time for each element in the array.
     * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. 
     * The first call to the callbackfn function provides this value as an argument instead of an array value.
     */
    public reduceRight(callbackfn: any, initialValue?: any): any {
        let data = this.getData();
        return Array.prototype.reduceRight.apply(data, arguments);
    }

    /**
     * Calls the specified callback function for all the elements in an array. 
     * The return value of the callback function is the accumulated result, 
     * and is provided as an argument in the next call to the callback function.
     * @param callbackfn A function that accepts up to four arguments. 
     * The reduce method calls the callbackfn function one time for each element in the array.
     * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. 
     * The first call to the callbackfn function provides this value as an argument instead of an array value.
     */
    public reduce(callbackfn: any, initialValue?: any): any {
        let data = this.getData();
        return Array.prototype.reduce.apply(data, arguments);
    }

    /**
     * Calls a defined callback function on each element of an array, 
     * and returns an array that contains the results.
     * @param callbackfn A function that accepts up to three arguments. 
     * The map method calls the callbackfn function one time for each element in the array.
     * @param thisArg An object to which the this keyword can refer in the callbackfn function. 
     * If thisArg is omitted, undefined is used as the this value.
     */
    public map<U>(callbackfn: (value: any, index: number, array: any[]) => U, thisArg?: any): U[] {
        let data = this.getData();
        return Array.prototype.map.apply(data, arguments);
    }

    /**
     * Adds all the elements of an array separated by the specified separator string.
     * @param separator A string used to separate one element of an array from the next in the resulting String. 
     * If omitted, the array elements are separated with a comma.
     */
    public join(separator?: string): string {
        let data = this.getData();
        return Array.prototype.join.apply(data, arguments);
    }

    /**
     * Determines whether all the members of an array satisfy the specified test.
     * @param callbackfn A function that accepts up to three arguments. 
     * The every method calls the callbackfn function for each element in array1 until the callbackfn returns false, 
     * or until the end of the array.
     * @param thisArg An object to which the this keyword can refer in the callbackfn function. 
     * If thisArg is omitted, undefined is used as the this value.
     */
    public every(callbackfn: any, thisArg?: any): boolean {
        let data = this.getData();
        return Array.prototype.every.apply(data, arguments);
    }

    /**
     * Returns a string that contains the concatenation of two or more strings.
     * @param strings The strings to append to the end of the string.
     */
    public concat(...strings: string[]): string {
        let data = this.getData();
        return Array.prototype.concat.apply(data, arguments);
    }

    /**
     * Sorts the elements of an array in place and returns the array
     * @param comparefn Optional compare function
     */
    public sort(comparefn?: any): any[] {
        comparefn = comparefn || ((a: any, b: any) => {
            if (String(a) < String(b)) return -1;
            if (String(a) > String(b)) return 1;
            return 0;
        });
        let wrapperFn = (a: AnyValue, b: AnyValue) => {
            return comparefn(makeRaw(a), makeRaw(b));
        };
        this.data.sort(wrapperFn);
        this.getState().u = this.document.nextDocVersion();
        return this.getData();
    }
}

interface SyncableArrayData extends AnyWithState {
    _s: State;
    v: any[];
}

interface IDMap {
    [index: string]: number;
}

interface ValueInterval {
    after: ObjectID;
    before: ObjectID;
    values: AnyValue[];
}

interface SyncableData {
    data: AnyWithState;
}

/**
 * Returns whether two values are the same type or not
 * @param one
 * @param two
 */
let sameType = (one: any, two: any): boolean => {
    if (one instanceof Syncable) one = one.getInternalData();
    if (two instanceof Syncable) two = two.getInternalData();
    return typeof one === typeof two;
};
