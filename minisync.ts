namespace Minisync {

    interface LastUid {
        at: number;
        uids: Array<number>;
    }

    interface State {
        id: string; // id of this state object
        u: string; // version of last update
        t: string; // timestamp of last change (iso string)
        r?: string; // removed in version
        a?: boolean; // true if this is the state for an array
        ri?: Array<ArrayRemovedObject>; // for arrays, list of removed objects
    }

    interface ArrayRemovedObject {
        id: string; // object with this state object id
        r: string; // was removed in this version
    }

    interface AnyWithState {
        [index: string]: any;
        _s: State;
    }

    /**
     * Base 64 encode/decode (6 bits per character)
     * (not MIME compatible)
     */
    let base64 = (function() {
        // characters are in ascii string sorting order
        const base64chars: string =
            '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ^_abcdefghijklmnopqrstuvwxyz';

        /**
         * Convert the integer portion of a Number to a base64 string
         * @param num
         * @returns string
         */
        function floatToBase64(num: number): string {
            let ret: string = '';
            num = Math.floor(num);
            while (num) {
                let chr = num - (Math.floor(num / 64) * 64);
                ret = base64chars[chr] + ret;
                num = Math.floor(num / 64);
            }
            return ret;
        }

        /**
         * Increments a base64 version string
         * @param v
         * @param minLength pad version strings to this length
         * When padding the version strings so they are the same length
         * the new version is always greater than the previous when compared with
         * the standard > operator.
         * @returns {string}
         */
        function nextVersion(v: string = '', minLength: number = 1): string {
            // handles initial version case
            // as well as padding to the appropriate length
            while (v.length < minLength) {
                v = base64chars[0] + v;
            }
            let carry: boolean = false;
            // increment the version string
            // by incrementing from right to left and carrying the overflow
            for (let i = v.length - 1; i >= 0; i--) {
                let pos: number = base64chars.indexOf(v[i]) + 1;
                carry = (pos >= base64chars.length);
                if (carry) pos -= base64chars.length;
                v = v.substr(0, i) + base64chars[pos] + v.substr(i+1);
                if (!carry) break;
            }
            if (carry) v = base64chars[1] + v;
            return v;
        }

        return {
            encodeFloat: floatToBase64,
            nextVersion: nextVersion
        }
    })();

    /**
     * Unique ID generator
     */
    var uid = (function() {

        var lastUid: LastUid = { at: null, uids: [] };
        /**
         * Returns a character string which is locally unique
         * It is based on the current date/time and Math.random
         * @returns string 8 characters, base64 = 48 bits
         */
        function create(): string {
            // base64.encodeFloat needs a 48 bit number to get 8 chars
            while(true) {
                // seconds = 32 bits (until 2038), 33 bits afterwards
                // Seconds ensures low risk of collisions across time.
                let seconds: number = Math.floor((new Date()).getTime() / 1000);
                if (seconds !== lastUid.at) {
                    lastUid = { at: seconds, uids: [] };
                }
                // 15 bits of randomness
                // random ensures low risk of collision inside a seconds
                let random: number =
                    Math.floor(Math.random() * Math.pow(2, 32)) &
                    (Math.pow(2, 15) - 1);
                // uid = 15 bits of random + 32/33 bits of time
                let uid: number = (random * Math.pow(2, 32)) + seconds;
                // end result is 47/48 bit random number
                // keep track of generated id's to avoid collisions
                if (lastUid.uids.indexOf(uid) === -1) {
                    lastUid.uids.push(uid);
                    return padStr(base64.encodeFloat(uid), 8);
                }
            }
        }

        /**
         * Add 48 bits of randomness to standard 8 char uid
         * @return {string} 16 character string
         */
        function createLong(): string {
            var random = Math.floor(
                (Math.random() * Math.pow(2, 47)) +
                (Math.random() * Math.pow(2, 32))
            );
            return create() + padStr(base64.encodeFloat(random), 8);
        }

        return { next: create, nextLong: createLong };
    })();

    /**
     * Returns true if the given parameter is an Array
     * @param v
     * @returns {boolean}
     */
    var isArray = function(v: any): boolean {
        return Object.prototype.toString.call(v) === '[object Array]';
    };

    /**
     * Left-pad a string to the desired length with zeroes
     * @param arg
     * @param {int} length
     * @returns {string}
     */
    function padStr(arg: any, length: number): string {
        let str: string = String(arg);
        while (str.length < length) str = '0' + str;
        return str;
    }

    /**
     * Return a date string which can be compared using < and >
     * @param {Date} [date]
     * @returns {String}
     */
    var dateToString = function(date: Date): string {
        if (!(date instanceof Date)) date = new Date();
        return padStr(date.getUTCFullYear(), 4) +
               padStr(date.getUTCMonth() + 1, 2) +
               padStr(date.getUTCDate(), 2) +
               padStr(date.getUTCHours(), 2) +
               padStr(date.getUTCMinutes(), 2) +
               padStr(date.getUTCSeconds(), 2);
    };

    /**
     * Returns whether two values are the same type or not
     * @param one
     * @param two
     */
    var sameType = function(one: any, two: any): boolean {
        if (one instanceof Syncable) one = one.data;
        if (two instanceof Syncable) two = two.data;
        return typeof one === typeof two;
    };

// Synchronizable object classes

    class Syncable {

        // the Document this Syncable exists in
        protected document: any;
        // the data this Syncable wraps
        protected data: any;

        /**
         * Syncable class constructor, wraps one synchronizing object in a document
         * @param document The master document this is linked to
         * @param data The data object it wraps
         * @param restore True if restoring from changes object
         */
        constructor(document?: any, data?: any, restore?: boolean) {
            if (document) this.setDocument(document);
            if (data) this.setData(data, restore);
        }

        /**
         * Sets the Document instance inside which this object exists
         * @param document
         */
        protected setDocument(document: any): void {
            this.document = document;
        }

        /**
         * Sets a new value for this Syncable object
         * @param data
         * @param restore If true, we are restoring from a saved changes object
         */
        protected setData(data: any, restore?: boolean): void {
            this.data = data;
            // make sure the state is initialized in the data object
            if (this.data) {
                this.getState();
                if (restore) {
                    for (var key in this.data) {
                        if (this.data.hasOwnProperty(key) && (key !== '_s')) {
                            var value = makeSyncable(this.document, this.data[key], true);
                            if (value instanceof Syncable) {
                                this.data[key] = value.data;
                            }
                        }
                    }
                }
            }
        }

        /**
         * Return the raw data object inside this Syncable
         * Is recursive, so the data object returned contains only the raw data
         * @returns {Object|Array|Number|String|Boolean}
         */
        public getData(): any {
            if (this.isRemoved()) return null;
            let result: any = this.data;
            if (typeof this.data == 'object') {
                result = {};
                for (let i in this.data) {
                    if (this.data.hasOwnProperty(i) && (i !== '_s')) {
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
            if (result && result['_s']) delete result['_s'];
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
        public getState(): any {
            if (!this.data) throw 'data property not set';
            if (!this.data._s) {
                if (!this.document) throw 'document property not set';
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
        public updateState(): any {
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
        public getVersion(): string {
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
         * Set a property on the data object, incrementing the version marker
         * @param key dot-separated property path
         * @param value
         */
        public set(key: string, value: any): void {
            // convert Syncable instances back into basic JSON
            value = makeRaw(value);
            let keyParts = String(key).split('.');
            key = keyParts.pop();
            // foo.bar
            if (keyParts.length) {
                this.get(keyParts.join('.')).set(key, value);
                // foo[2], foo[2][1]
            } else if (key.substr(-1) == ']') {
                let index = key.substr(0, key.length-1).split('[').pop();
                key = key.split('[').slice(0, -1).join('[');
                this.get(key).set(index, value);
                // bar, 2
            } else if (!this.isRemoved()) {
                this.data[key] = value;
                this.updateState();
            }
        }

        /**
         * Get a property from the data object
         * @param key dot-separated property path
         * @param [ifRemoved] also return it if it was removed
         * @returns {Syncable|SyncableArray}
         */
        public get(key: string, ifRemoved?: boolean): any {
            let keyParts = String(key).split('.');
            key = keyParts.shift();
            let value: Syncable = this;
            // [1], foo[1], foo[1][2]
            if (key.indexOf('[') >= 0) {
                // foo[1], foo[1][2]
                if (key.indexOf('[') > 0) {
                    // strip off "foo", keep [1], [1][2]
                    value = value.get(key.split('[').shift());
                    key = key.substr(key.indexOf('['));
                }
                // copy out last array index
                let index = key.substr(0, key.length-1).split('[').pop();
                // if there are nested indices (e.g. [1][2])
                if (key.split('[').length > 2) {
                    key = key.split('[').slice(0, -1).join('[');
                    value = value.get(key);
                }
                key = index;
            }
            value = (value?value.getInternalData():null || {})[key];
            value = makeSyncable(this.document, value);
            if (keyParts.length) {
                value = value.get(keyParts.join('.'));
            }
            // don't return removed values
            if ((value instanceof Syncable) && value.isRemoved() && !ifRemoved) value = null;
            return value;
        }

        /**
         * Mark this object as removed
         */
        public remove(): void {
            if (!this.isRemoved()) {
                let state = this.getState();
                state.r = this.document.nextDocVersion();
                state.t = dateToString(new Date());
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
        public getChangesSince(version: string, resultSetter?: any): any {
            let result: any = null;
            for (let key in this.data) {
                if (this.data.hasOwnProperty(key) && (key !== '_s')) {
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
                        if (this.getVersion() > version) {
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
                result._s.r = this.isRemoved()
            }
            return result;
        }

        /**
         * Merge the changes of the remote value object with the local value object
         * @protected
         * @param changes Object containing all the key/value pairs to update
         * @param clientState Client state for the client we're synchronizing from
         */
        public mergeChanges(changes: AnyWithState, clientState: any): void {
            if (!changes) return;
            // if the remote version of the object is newer than the last received
            let otherIsNewer: boolean = ( changes._s &&
            ( (changes._s.u > clientState.lastReceived) &&
                // and the local data version is older the last local document version
                // that was acknowledged by the remote (no conflict)
            ( (this.getVersion() <= clientState.lastAcknowledged) ||
                // or the remote timestamp is not older than the local timestamp
                // (conflict solved in favor of remote value)
            (changes._s.t >= this.getTimeStamp())
            )
            ) );
            Object.keys(changes).forEach(function(key: string) {
                if (key === '_s') return;
                let remoteValue: any = changes[key];
                // if primitive value
                // copy remote non-object properties to local object
                if (!remoteValue._s) {
                    // if the remote version of the object is newer than the last received
                    if ( otherIsNewer &&
                            // and the property value is different from the local value
                        (this.get(key) !== remoteValue) )
                    {
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
            // if the other was removed, remove it here also,
            // even if the local value is newer
            var otherIsRemoved: boolean = !!(changes._s && changes._s.r);
            if (otherIsRemoved) this.remove();
        }

    }

    function makeSyncable(document: any, data: any, restore?: boolean): any {
        var restoringArray = restore && data && data._s && data._s.a;
        if (isArray(data) || restoringArray) {
            return new SyncableArray(document, data, restore);
        } else if ((typeof data == 'object') && !(data instanceof Syncable)) {
            return new Syncable(document, data, restore);
        } else return data;
    }

    function makeRaw(data: any): any {
        if (data instanceof Syncable) data = data.getData();
        return data;
    }

    class SyncableArray extends Syncable {

        /**
         * Syncable Array class constructor, wraps one synchronizing array in a document
         * @param document The master document this is linked to
         * @param data The data array it wraps
         * @param restore Whether we are restoring from a changes object
         * @constructor
         */
        constructor(document: any, data: any, restore?: boolean) {
            if (restore) {
                super(document, data.v, restore);
                this.data._s = data._s;
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
        public getData(): any {
            let result: any = null;
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
        public getChangesSince(version: string): any {
            return super.getChangesSince(version,
                function(result: any, key: string, value: any): void {
                    result.v[key] = value;
                }
            );
        }

        /**
         * Overridden from parent
         * @returns {{_s: {id: String, u: string, t: String}}}
         */
        public getChangesResultObject(): AnyWithState {
            let result: any = super.getChangesResultObject();
            result._s.a = true;
            result.v = [];
            if (this.getRemoved().length) {
                result._s.ri = this.getRemoved();
            }
            return result;
        }

        /**
         * Overridden from Syncable, merge changes for an array type
         * @param changes
         * @param clientState
         */
        public mergeChanges(changes: any, clientState: any): void {
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
                    changes._s.ri.forEach(function(removed: any) {
                        this.forEach(function (value: any, index: number): void {
                            if (value && value.getID && (value.getID() === removed.id)) {
                                this.splice(index, 1);
                            }
                        }, this);
                    }, this);
                }

                // maps value id to index
                let localIDs: any = this.getIdMap();
                let remoteIDs: any = {};

                // synchronize all value objects present in both local and remote
                changes.v.forEach(function(remoteValue: any, remoteIndex: number): void {
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
                let remoteChanged: boolean = (changes._s.u > clientState.lastReceived);
                if (remoteChanged) {
                    let sortedData = this.sortByRemote(changes.v);
                    this.data.splice.apply(this.data, [0, this.data.length].concat(sortedData));

                    let otherIsNewer: boolean =
                        ( remoteChanged &&
                            // and the local data version is older the last local document version
                            // that was acknowledged by the remote (no conflict)
                        ( (this.getVersion() <= clientState.lastAcknowledged) ||
                            // or the remote timestamp is not older than the local timestamp
                            // (conflict solved in favor of remote value)
                        (changes._s.t >= this.getTimeStamp())
                        )
                        );

                    let createIntervals: any = function (changes: any, localIDs: any) {
                        let localValue: any, remoteValue: any;
                        // remote values in between objects that exist on both sides
                        let intervals: Array<any> = [];
                        let interval: Array<any> = [];
                        let lastID: string = null;
                        let v: any = changes.v || [];
                        // synchronize the objects that exist on both sides
                        for (let i = 0; i < v.length; i++) {
                            remoteValue = v[i];
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
                    };
                    let intervals: any = createIntervals.call(this, changes, localIDs);

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
        public sortByRemote(remote: Array<any>): Array<any> {
            let data = this.data;
            if (!isArray(remote)) return data;
            let localIDs = this.getIdMap();
            // construct map of remote object ID's that also exist locally
            let sharedIDs: Array<string> = [];
            remote.forEach(function(remoteValue: any): void {
                if (!remoteValue || !remoteValue._s) return;
                if (!localIDs[remoteValue._s.id]) return;
                sharedIDs.push(remoteValue._s.id);
            }, this);
            // split local array into chunks
            let chunks: Array<any> = [], chunk: Array<any> = [];
            data.forEach(function(localValue: any): void {
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
            chunks.sort(function(a: any, b: any): number {
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
        public mergeInterval(interval: any): void {
            let start: number = interval.after ? (this.indexOf(interval.after, 0, true)+1) : 0;
            let end: number = interval.before ? this.indexOf(interval.before, 0, true) : this.length();
            let local: Array<any> = this.slice(start, end);
            let values: Array<any> = [].concat(interval.values);
            local.forEach(function(value: any): void {
                if (value && value._s) values.push(value);
            });
            Array.prototype.splice.apply(this.data, [start, end - start].concat(values));
        }

        /**
         * Returns object mapping value object id to index in array where it is found
         * @return object
         */
        public getIdMap(): any {
            let localValue: any;
            // build index mapping local object id's to positions
            let localIDs: any = {};
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
            let item: any = makeSyncable(this.document, this.data.splice(index, 1).pop());
            let result: any = makeRaw(item);
            let state: any = this.updateState();
            if (item instanceof Syncable) {
                item.remove();
                if (!isArray(state.ri)) state.ri = [];
                state.ri.push({id: item.getID(), r: state.u});
            }
            return result;
        }

        /**
         * Returns the array of removed id's
         * @returns {Array}
         */
        public getRemoved(): Array<string> {
            let state = this.getState();
            return (state ? state.ri : []) || [];
        }

        /**
         * Returns the length of the array
         * @returns {number}
         */
        public length(): number {
            return this.data.length;
        }

        public forEach(callback: any, thisArg: any): void {
            this.data.forEach(function(value: any, index: number, arr: Array<any>): void {
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
                searchElement = searchElement.data;
            }
            return this.data.lastIndexOf(searchElement, fromIndex);
        }

        public pop(): any {
            let item: any = this.data.slice().pop();
            let index: number = this.lastIndexOf(item);
            this.removeAt(index);
            if (item && item['_s']) delete item['_s'];
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
            var v = makeRaw(this.get('0'));
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
            let removed: Array<any> = [];
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
        public slice(begin: number, end: number): Array<any> {
            return this.data.slice(begin, end);
        }

        public unshift(element: any): any {
            this.getState().u = this.document.nextDocVersion();
            return this.data.unshift.apply(this.data, arguments);
        }

        /**
         * Determines whether the specified callback function returns true for any element of an array.
         * @param callbackfn A function that accepts up to three arguments. The some method calls the callbackfn function for each element in array1 until the callbackfn returns true, or until the end of the array.
         * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
         */
        public some(callbackfn: any, thisArg?: any): boolean {
            let data = this.getData();
            return Array.prototype.some.apply(data, arguments);
        }

        /**
         * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
         * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
         * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
         */
        public reduceRight(callbackfn: any, initialValue?: any): any {
            let data = this.getData();
            return Array.prototype.reduceRight.apply(data, arguments);
        }

        /**
         * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
         * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
         * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
         */
        public reduce(callbackfn: any, initialValue?: any): any {
            let data = this.getData();
            return Array.prototype.reduce.apply(data, arguments);
        }

        /**
         * Calls a defined callback function on each element of an array, and returns an array that contains the results.
         * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
         * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
         */
        public map<U>(callbackfn: (value: any, index: number, array: any[]) => U, thisArg?: any): U[] {
            let data = this.getData();
            return Array.prototype.map.apply(data, arguments);
        }

        /**
         * Adds all the elements of an array separated by the specified separator string.
         * @param separator A string used to separate one element of an array from the next in the resulting String. If omitted, the array elements are separated with a comma.
         */
        public join(separator?: string): string {
            let data = this.getData();
            return Array.prototype.join.apply(data, arguments);
        }

        /**
         * Determines whether all the members of an array satisfy the specified test.
         * @param callbackfn A function that accepts up to three arguments. The every method calls the callbackfn function for each element in array1 until the callbackfn returns false, or until the end of the array.
         * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
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

        // TODO: implement support for sort() in some way
    }

    class Document extends Syncable {

        /**
         * Document class constructor
         * @param data Initial data for this instance, or a changes object (generated by getChanges)
         * @param restore If true, create this document as the client that generated the changes object
         * @constructor Document
         */
        constructor(data:any, restore?:boolean) {
            if (typeof data != 'object') throw 'Argument must be an object';
            if (isArray(data)) throw 'Argument cannot be an array';
            let isChanges:boolean =
                data && data._minisync && (data._minisync.dataType == 'CHANGES');
            if (isChanges && data.changesSince) throw 'change block must be non-delta';
            let shouldMerge:boolean = isChanges && !restore;
            let shouldRestore:boolean = isChanges && restore;
            super();
            this.setDocument(this);
            if (shouldMerge) {
                this.setData({});
                // ensure an initial state exists
                this.getDocVersion();
                this.mergeChanges(data);
                // for all client states, mark last confirmed send as current version
                let clientStates:any = this.getClientStates();
                for (let i:number = 0; i < clientStates.length; i++) {
                    let clientState = clientStates[i];
                    clientState.lastAcknowledged = this.getDocVersion();
                }
            } else if (shouldRestore) {
                this.setData(data.changes, true);
                this.setClientID(data.sentBy);
                this.setDocVersion(data.fromVersion);
                this.setClientStates(data.clientStates);
            } else { // first init from raw data
                this.setData(data);
                // ensure an initial state exists
                this.getDocVersion();
            }
        }

        /**
         * Return the unique client ID of the document on this machine
         * @return {string}
         */
        public getClientID(): string {
            let state: any = this.getState();
            if (!state.clientID) state.clientID = uid.nextLong();
            return state.clientID;
        }

        /**
         * Change the unique client ID of the document on this machine
         * @param {string} id
         */
        private setClientID(id: string): void {
            this.getState().clientID = id;
        }

        /**
         * Return the master version for this document
         * @returns {string}
         */
        public getDocVersion(): string {
            let version: string = this.getState().v;
            if (!version) version = this.nextDocVersion();
            return version;
        }

        /**
         * Set the version of this document to a different one
         * @param {string} v
         */
        private setDocVersion(v: string): void {
            this.getState().v = v;
        }

        /**
         * Increment the document version and return it
         * @returns {string}
         */
        public nextDocVersion(): string {
            return this.getState().v =
                base64.nextVersion(this.getState().v, 6);
        }

        /**
         * Get the state object for a remote client
         * @param {String} clientID
         * @return {*} state object = {clientID, lastAcknowledged, lastReceived}
         */
        public getClientState(clientID: string): any {
            let states: Array<any> = this.getClientStates();
            let clientData: any;
            for (let i: number = 0; i < states.length; i++) {
                if (states[i].clientID === clientID) {
                    clientData = states[i];
                    break;
                }
            }
            if (!clientData) states.push(clientData = {
                clientID: clientID,
                // local version last confirmed as received remotely
                // we should send only newer versions than this
                lastAcknowledged: null,
                // remote version that was last received
                // we can ignore older remote versions than this
                lastReceived: null
            });
            return clientData;
        }

        /**
         * Return an array of the remote state objects for all known clients
         * @returns {Array}
         */
        public getClientStates(): Array<any> {
            let state: any = this.getState();
            if (!state.remote) state.remote = [];
            return state.remote;
        }

        /**
         * Set a new array of remote client states
         * @param states
         */
        private setClientStates(states: Array<any>): void {
            let state: any = this.getState();
            state.remote = states || [];
        }

        /**
         * Get updates to send to a remote client
         * @param {String} [clientID] Unique ID string for the remote client to get a delta update.
         * Leave empty to generate a universal state object containing the whole document
         * that can be synchronized against any remote client (even if never synced before)
         * @returns {*} data object to send
         */
        public getChanges(clientID: string): any {
            let changesSince: string = null;
            if (clientID) {
                let clientState: any = this.getClientState(clientID);
                changesSince = clientState.lastAcknowledged;
            }
            let changes: any = this.getChangesSince(changesSince);
            return {
                _minisync: {
                    dataType: 'CHANGES',
                    version: 1
                },
                sentBy: this.getClientID(),
                fromVersion: this.getDocVersion(),
                clientStates: this.getClientStates(),
                changesSince: changesSince,
                changes: changes
            };
        }

        /**
         * Merge updates from a remote client, updating the data and P2P client state
         * @param data Change data
         * @returns {*} data object to send
         */
        public mergeChanges(data: any): void {
            // state of remote client as stored in this copy of the document
            let clientState: any = this.getClientState(data.sentBy);
            // state of this client as stored in the remote copy of the document
            let remoteState: any = null;
            for (let i: number = 0; i < data.clientStates.length; i++) {
                if (data.clientStates[i].clientID == this.getClientID()) {
                    remoteState = data.clientStates[i];
                    break;
                }
            }
            if (remoteState && (clientState.lastAcknowledged < remoteState.lastReceived)) {
                clientState.lastAcknowledged = remoteState.lastReceived;
            }
            let allWasSent: boolean = clientState.lastAcknowledged === this.getDocVersion();
            // inherited, actual merging of changes
            Syncable.prototype.mergeChanges.call(this, data.changes, clientState);
            clientState.lastReceived = data.fromVersion;

            for (let j: number = 0; j < data.clientStates.length; j++) {
                remoteState = data.clientStates[j];
                if (remoteState.clientID != this.getClientID()) {
                    let localState: any = this.getClientState(remoteState.clientID);
                    // update remote version that was last received
                    if (localState.lastReceived < remoteState.lastReceived) {
                        localState.lastReceived = remoteState.lastReceived;
                    }
                    // if our state matches the state of the other client
                    // and their state matches the state of the third party
                    // the third party has received our version already
                    if (allWasSent && (data.fromVersion == remoteState.lastAcknowledged)) {
                        localState.lastAcknowledged = this.getDocVersion();
                    }
                }
            }

            // syncing updates the local version
            // we shouldn't send updates for versions added by syncing
            if (allWasSent) {
                clientState.lastAcknowledged = this.getDocVersion();
            }
        }

    }

    // TODO: P2P communication mechanism (default implementation)

// Public API

    let minisync: any = function (data: any): any {
        return new Document(data || {});
    };
    minisync.createID = uid.next;
    minisync.restore = function(data: any): any {
      return new Document(data || {}, true);
    };

// Private API exposed for unit tests only

    minisync._private = {
        nextVersion: base64.nextVersion,
        dateToString: dateToString,
        createLongID: uid.nextLong,
        Syncable: Syncable,
        SyncableArray: SyncableArray
    };


    window['minisync'] = minisync;
}
