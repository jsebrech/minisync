(function(scope) {
    "use strict";

    /**
     * Base 64 encode/decode (6 bits per character)
     * (not MIME compatible)
     */
    var base64 = (function() {
        // characters are in ascii string sorting order
        var base64chars =
            '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ^_abcdefghijklmnopqrstuvwxyz';

        /**
         * Convert the integer portion of a Number to a base64 string
         * @param num
         * @returns string
         */
        function floatToBase64(num) {
            var ret = '';
            num = Math.floor(num);
            while (num) {
                var chr = num - (Math.floor(num / 64) * 64);
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
        function nextVersion(v, minLength) {
            // cast to string
            if (typeof v === 'undefined') v = '';
            v = '' + v;
            minLength = minLength || 1;
            // handles initial version case
            // as well as padding to the appropriate length
            while (v.length < minLength) {
                v = base64chars[0] + v;
            }
            // increment the version string
            // by incrementing from right to left and carrying the overflow
            for (var i = v.length - 1; i >= 0; i--) {
                var pos = base64chars.indexOf(v[i]) + 1;
                var carry = (pos >= base64chars.length);
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
        var lastUid = { at: null };
        /**
         * Returns a character string which is locally unique
         * It is based on the current date/time and Math.random
         * @returns string 8 characters, base64 = 48 bits
         */
        function create() {
            // TODO: try to pick holes in the reasoning here
            // base64.encodeFloat needs a 48 bit number to get 8 chars
            while(true) {
                // first part is about avoiding collisions locally
                // through the law of large numbers
                var seconds = Math.floor((new Date()).getTime() / 1000);
                if (seconds !== lastUid.at) {
                    lastUid = { at: seconds, uids: [] };
                }
                // seconds = 32 bits (until 2038 at least)
                // Seconds ensures low risk of collisions across time.
                var uid = Math.floor(seconds +
                    // Add 20 bits of randomness offset by 27 bits = 47 bits
                    // Randomness ensures multiple id's per second +
                    // low risk of collisions across peers
                    ( Math.floor(Math.random() * Math.pow(2, 20)) *
                      Math.pow(2, 27) ));
                // end result is 48 bit random number
                // Note that the five high bits of the seconds overlap
                // with the low five bits of the random number,
                // meaning collisions can occur one second every 2 years (78 / 2^5)
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
        function createLong() {
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
    var isArray = function(v) {
        return Object.prototype.toString.call(v) === '[object Array]';
    };

    /**
     * Left-pad a string to the desired length with zeroes
     * @param str
     * @param {int} length
     * @returns {string}
     */
    function padStr(str, length) {
        str = String(str);
        while (str.length < length) str = '0' + str;
        return str;
    }

    /**
     * Return a date string which can be compared using < and >
     * @param {Date} [date]
     * @returns {String}
     */
    var dateToString = function(date) {
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
    var sameType = function(one, two) {
        if (one instanceof Syncable) one = one.data;
        if (two instanceof Syncable) two = two.data;
        return typeof one === typeof two;
    };

// Synchronizable object classes

    /**
     * Syncable class constructor, wraps one synchronizing object in a document
     * @param document The master document this is linked to
     * @param data The data object it wraps
     * @constructor
     */
    function Syncable(document, data) {
        this.setDocument(document);
        this.setData(data);
    }

    function makeSyncable(document, data) {
        if (isArray(data)) {
            return new SyncableArray(document, data);
        } else if ((typeof data == 'object') && !(data instanceof Syncable)) {
            return new Syncable(document, data);
        } else return data;
    }

    function makeRaw(data) {
        if (data instanceof Syncable) data = data.getData();
        return data;
    }

    /**
     * Sets the Document instance inside which this object exists
     * @param document
     * @internal
     */
    Syncable.prototype.setDocument = function(document) {
        this.document = document;
    };

    /**
     * Sets a new value for this Syncable object
     * @param data
     * @internal
     */
    Syncable.prototype.setData = function(data) {
        this.data = data;
        // make sure the state is initialized in the data object
        if (this.data) this.getState();
    };

    /**
     * Return the raw data object inside this Syncable
     * Is recursive, so the data object returned contains only the raw data
     * @returns {Object|Array|Number|String|Boolean}
     */
    Syncable.prototype.getData = function() {
        if (this.isRemoved()) return null;
        var result = this.data;
        if (typeof this.data == 'object') {
            result = {};
            for (var i in this.data) {
                if (this.data.hasOwnProperty(i) && (i !== '_s')) {
                    var v = makeSyncable(this.document, this.data[i]);
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
    };

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
    Syncable.prototype.getState = function() {
        if (!this.data) throw 'data property not set';
        if (!this.data._s) {
            if (!this.document) throw 'document property not set';
            this.data._s = { id: uid.next() };
            this.data._s.u = this.document.getDocVersion();
            this.data._s.t = dateToString(new Date());
        }
        return this.data._s;
    };

    /**
     * Update the internal state object
     * @returns {{id: string}|*|{id: *, u: string}}
     */
    Syncable.prototype.updateState = function() {
        var state = this.getState();
        state.u = this.document.nextDocVersion();
        state.t = dateToString(new Date());
        return state;
    };

    /**
     * Return the unique id of this object
     * @returns {String}
     */
    Syncable.prototype.getID = function() {
        return this.getState().id;
    };

    /**
     * Return the version the properties on this object were last updated
     * @returns {string}
     */
    Syncable.prototype.getVersion = function() {
        return this.getState().u;
    };

    /**
     * Return the timestamp this object was last updated
     * @returns {String}
     */
    Syncable.prototype.getTimeStamp = function() {
        return this.getState().t;
    };

    /**
     * Set a property on the data object, incrementing the version marker
     * @param key dot-separated property path
     * @param value
     */
    Syncable.prototype.set = function(key, value) {
        // convert Syncable instances back into basic JSON
        value = makeRaw(value);
        var keyParts = String(key).split('.');
        key = keyParts.pop();
        // foo.bar
        if (keyParts.length) {
            this.get(keyParts.join('.')).set(key, value);
        // foo[2], foo[2][1]
        } else if (key.substr(-1) == ']') {
            var index = key.substr(0, key.length-1).split('[').pop();
            key = key.split('[').slice(0, -1).join('[');
            this.get(key).set(index, value);
        // bar, 2
        } else if (!this.isRemoved()) {
            this.data[key] = value;
            this.updateState();
        }
    };

    /**
     * Get a property from the data object
     * @param key dot-separated property path
     * @returns {Syncable}
     */
    Syncable.prototype.get = function(key) {
        var keyParts = String(key).split('.');
        key = keyParts.shift();
        var value = this;
        // [1], foo[1], foo[1][2]
        if (key.indexOf('[') >= 0) {
            // foo[1], foo[1][2]
            if (key.indexOf('[') > 0) {
                // strip off "foo", keep [1], [1][2]
                value = value.get(key.split('[').shift());
                key = key.substr(key.indexOf('['));
            }
            // copy out last array index
            var index = key.substr(0, key.length-1).split('[').pop();
            // if there are nested indices (e.g. [1][2])
            if (key.split('[').length > 2) {
                key = key.split('[').slice(0, -1).join('[');
                value = value.get(key);
            }
            key = index;
        }
        value = (value?value.data:null || {})[key];
        value = makeSyncable(this.document, value);
        if (keyParts.length) {
            value = value.get(keyParts.join('.'));
        }
        // don't return removed values
        if ((value instanceof Syncable) && value.isRemoved()) value = null;
        return value;
    };

    /**
     * Mark this object as removed
     */
    Syncable.prototype.remove = function() {
        if (!this.isRemoved()) {
            var state = this.getState();
            state.r = this.document.nextDocVersion();
            state.t = dateToString(new Date());
        }
    };

    /**
     * Returns the version at which this was removed, if any
     * @returns {String|null}
     */
    Syncable.prototype.isRemoved = function() {
        return this.data ? this.getState().r : null;
    };

    /**
     * Return a data object with all the changed objects since a version
     * @param version (string)
     * @param [resultSetter] (Function) Function that sets a value on a result object
     * @returns {*} this object and all its changed properties, or null if nothing changed
     */
    Syncable.prototype.getChangesSince = function(version, resultSetter) {
        var result = null;
        for (var key in this.data) {
            if (this.data.hasOwnProperty(key) && (key !== '_s')) {
                var value = this.get(key);
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
    };

    /**
     * Returns an object containing an empty result object for this value object
     * @private
     * @returns {{_s: {id: String, u: string, t: String}}}
     */
    Syncable.prototype.getChangesResultObject = function() {
        var result = {
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
    };

    /**
     * Merge the changes of the remote value object with the local value object
     * @protected
     * @param changes Object containing all the key/value pairs to update
     * @param clientState Client state for the client we're synchronizing from
     */
    Syncable.prototype.mergeChanges = function(changes, clientState) {
        if (!changes) return;
        // if the remote version of the object is newer than the last received
        var otherIsNewer = ( changes._s &&
            ( (changes._s.u > clientState.lastReceived) &&
              // and the local data version is older the last local document version
              // that was acknowledged by the remote (no conflict)
              ( (this.getVersion() <= clientState.lastConfirmedSend) ||
                // or the remote timestamp is not older than the local timestamp
                // (conflict solved in favor of remote value)
                (changes._s.t >= this.getTimeStamp())
                )
            ) );
        for (var key in changes) {
            if (key === '_s') continue;
            if (changes.hasOwnProperty(key)) {
                var remoteValue = changes[key];
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
                    var expectType = (remoteValue._s.a) ? [] : {};
                    if (!sameType(this.get(key), expectType)) {
                        this.set(key, expectType);
                        this.get(key).getState().u = null;
                    }
                    this.get(key).mergeChanges(remoteValue, clientState);
                }
            }
        }
        // TODO: synchronize removed values
    };

    /**
     * Syncable Array class constructor, wraps one synchronizing array in a document
     * @param document The master document this is linked to
     * @param data The data array it wraps
     * @constructor
     */
    function SyncableArray(document, data) {
        if (!isArray(data)) data = [];
        Syncable.call(this, document, data);
    }
    SyncableArray.prototype = new Syncable(null, null);

    /**
     * Overridden getData() for the array subtype
     * Converts the object back into a simple array (no added properties)
     * @returns {Array}
     */
    SyncableArray.prototype.getData = function() {
        var result = null;
        if (isArray(this.data)) {
            // make a copy, and recurse
            result = this.data.slice();
            for (var i in result) {
                if (result.hasOwnProperty(i)) {
                    var v = makeSyncable(this.document, result[i]);
                    if (v instanceof Syncable) {
                        if (v.isRemoved()) continue;
                        result[i] = v.getData();
                    }
                }
            }
        }
        return result;
    };

    /**
     * Return a data object with all the changed objects since a version
     * @param version (string)
     * @returns {*} this object and all its changed properties, or null if nothing changed
     */
    SyncableArray.prototype.getChangesSince = function(version) {
        return Syncable.prototype.getChangesSince.call(this, version,
            function(result, key, value) {
                result.v[key] = value;
            }
        );
    };

    /**
     * Overridden from parent
     * @returns {{_s: {id: String, u: string, t: String}}}
     */
    SyncableArray.prototype.getChangesResultObject = function() {
        var result = Syncable.prototype.getChangesResultObject.call(this);
        result._s.a = true;
        result.v = [];
        if (this.getRemoved().length) {
            result._s.ri = this.getRemoved();
        }
        return result;
    };

    /**
     * Overridden from Syncable, merge changes for an array type
     * @param changes
     * @param clientState
     */
    SyncableArray.prototype.mergeChanges = function(changes, clientState) {
        /*
        Assumptions:

        - changes = object with:
          _s: state object
          v: array of values

        - v: complete array, all items from the source client are present
        - v[i] can be primitive or object/array
        - object values may be sparse (don't contain child values)

        - when objects are moved inside the array, this is a copy+delete
          meaning the ordering of object state id's remains the same
          (new id's are added, old id's are removed, but the relative
           order of existing id's never changes)
         */

        if (changes && changes._s && isArray(changes.v)) {
            var otherIsNewer =
                // the remote version of the array is newer than the last received
                ( (changes._s.u > clientState.lastReceived) &&
                  // and the local data version is older the last local document version
                  // that was acknowledged by the remote (no conflict)
                  ( (this.getVersion() <= clientState.lastConfirmedSend) ||
                    // or the remote timestamp is not older than the local timestamp
                    // (conflict solved in favor of remote value)
                    (changes._s.t >= this.getTimeStamp())
                  )
                );

            // TODO: handle removed objects

            var i, localValue, remoteValue;
            // build index mapping local object id's to positions
            var localIDs = {};
            for (i = 0; i < this.length(); i++) {
                localValue = this.get(i);
                if (localValue instanceof Syncable) {
                    localIDs[localValue.getID()] = i;
                }
            }

            // remote values in between objects that exist on both sides
            var intervals = [];
            var interval = [];
            var lastID = null;
            // synchronize the objects that exist on both sides
            for (i = 0; i < changes.v.length; i++) {
                remoteValue = changes.v[i];
                if (remoteValue && remoteValue._s) {
                    if (localIDs[remoteValue._s.id] !== undefined) {
                        localValue = this.get(localIDs[remoteValue._s.id]);
                        localValue.mergeChanges(remoteValue, clientState);
                        if (interval.length) {
                            intervals.push({
                                after: lastID,
                                before: localValue.getID(),
                                values: interval
                            });
                            interval = [];
                            lastID = localValue.getID()
                        }
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

            // synchronize the intervals between the objects that exist on both sides
            if (otherIsNewer) {
                while (intervals.length) {
                    this.mergeInterval(intervals.shift());
                }
            }
        }
    };

    /**
     * Merge a remote interval (= array of values) into a local range
     * @param {object} interval
     * { after: string = id, before: string = id, data: array }
     */
    SyncableArray.prototype.mergeInterval = function(interval) {
        var start = interval.after ? (this.indexOf(interval.after, 0, true)+1) : 0;
        var end = interval.before ? this.indexOf(interval.before, 0, true) : this.length();
        var local = this.slice(start, end);
        // TODO: handle newer objects in local interval
        this.splice.apply(this, [start, end - start].concat(interval.data));
    };

    /**
     * Remove the item / object at the specified index
     * @param index
     * @result {*} The removed value
     */
    SyncableArray.prototype.removeAt = function(index) {
        var item = makeSyncable(this.document, this.data.splice(index, 1).pop());
        var result = makeRaw(item);
        var state = this.updateState();
        if (item instanceof Syncable) {
            item.remove();
            if (!isArray(state.ri)) state.ri = [];
            state.ri.push({id: item.getID(), r: state.u});
        }
        return result;
    };

    /**
     * Returns the array of removed id's
     * @returns {Array}
     */
    SyncableArray.prototype.getRemoved = function() {
        var state = this.getState();
        return (state ? state.ri : []) || [];
    };

    /**
     * Returns the length of the array
     * @returns {length|Number|number}
     */
    SyncableArray.prototype.length = function() {
        return this.data.length;
    };

    SyncableArray.prototype.forEach = function(callback, thisArg) {
        this.data.forEach(function(value, index, arr) {
            value = makeSyncable(this.document, value);
            return callback.call(thisArg, value, index, arr);
        }, this);
    };

    /**
     * Array.indexOf
     * @param searchElement
     * @param [fromIndex]
     * @param [isObjectID] true if the searchElement is the ID of an object
     * @returns {*}
     */
    SyncableArray.prototype.indexOf = function(searchElement, fromIndex, isObjectID) {
        if (searchElement instanceof Syncable) {
            searchElement = searchElement.getID();
            isObjectID = true;
        }
        if (isObjectID) {
            for (var i = 0; i < this.data.length; i++) {
                var value = this.get(i);
                if (value instanceof Syncable) {
                    if (value.getID() === searchElement) return i;
                }
            }
            return -1;
        } else {
            return this.data.indexOf(searchElement, fromIndex);
        }
    };

    SyncableArray.prototype.lastIndexOf = function(searchElement, fromIndex) {
        if (searchElement instanceof Syncable) {
            searchElement = searchElement.data;
        }
        return this.data.lastIndexOf(searchElement, fromIndex);
    };

    SyncableArray.prototype.pop = function() {
        var item = this.data.slice().pop();
        var index = this.lastIndexOf(item);
        this.removeAt(index);
        if (item && item['_s']) delete item['_s'];
        return item;
    };

    SyncableArray.prototype.push = function() {
        this.getState().u = this.document.nextDocVersion();
        return this.data.push.apply(this.data, arguments);
    };

    SyncableArray.prototype.reverse = function() {
        this.getState().u = this.document.nextDocVersion();
        this.data.reverse();
        return this;
    };

    SyncableArray.prototype.shift = function() {
        if (!this.data || !this.data.length) return null;
        var v = makeRaw(this.get('0'));
        this.removeAt(0);
        return v;
    };

    /**
     * array.splice()
     * @param index position to splice at
     * @param [howMany] number of elements to remove,
     * @param [element1] element to insert (followed by others)
     */
    SyncableArray.prototype.splice = function(index, howMany, element1) {
        var removed = [];
        var elements = Array.prototype.slice.call(arguments, 2);
        while (howMany-- > 0) {
            removed.push(this.removeAt(index));
        }
        while (elements.length > 0) {
            this.data.splice(index, 0, null);
            this.set(index, elements.pop());
        }
        return removed;
    };

    /**
     * array.slice()
     * @param begin
     * @param [end]
     * @returns {Array}
     */
    SyncableArray.prototype.slice = function(begin, end) {
        return this.data.slice(begin, end);
    };

    SyncableArray.prototype.unshift = function(element) {
        this.getState().u = this.document.nextDocVersion();
        return this.data.unshift.apply(this.data, arguments);
    };

    // add remaining array functions to SyncableArray
    (function() {
        // all of these operations are supported, list taken from
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
        // TODO: implement support for sort() in some way
        var arrayFns = [
            'concat', 'every', 'forEach', 'indexOf', 'join', 'lastIndexOf',
            'map', 'pop', 'push', 'reduce', 'reduceRight',
            'reverse', 'shift', 'slice', 'some', 'splice', 'unshift'];
        // generic array method
        // used for: concat, every, join, map, reduce, reduceRight, slice, some
        var createArrayFn = function(fn) {
            return function() {
                var data = this.getData();
                return Array.prototype[fn].apply(data, arguments);
            };
        };
        var fn;
        while (fn = arrayFns.pop()) {
            if (!SyncableArray.prototype[fn]) {
                SyncableArray.prototype[fn] = createArrayFn(fn);
            }
        }
    })();

    /**
     * Document class constructor
     * @param data Initial data for this instance, or a changes object (generated by getChanges)
     * @constructor Document
     */
    function Document(data) {
        if (typeof data != 'object') throw 'Argument must be an object';
        if (isArray(data)) throw 'Argument cannot be an array';
        var isChanges =
            data && data._minisync && (data._minisync.dataType == 'CHANGES');
        if (isChanges && data.changesSince) throw 'change block must be non-delta';
        Syncable.call(this, this, isChanges ? {} : data);
        // ensure an initial state exists
        this.getDocVersion();
        if (isChanges) {
            this.mergeChanges(data);
            // for all client states, mark last confirmed send as current version
            var clientStates = this.getClientStates();
            for (var i = 0; i < clientStates.length; i++) {
                var clientState = clientStates[i];
                clientState.lastConfirmedSend = this.getDocVersion();
            }
        }
    }
    Document.prototype = new Syncable(null, null);

    /**
     * Return the unique client ID of the document on this machine
     * @return {string}
     */
    Document.prototype.getClientID = function() {
        var state = this.getState();
        if (!state.clientID) state.clientID = uid.nextLong();
        return state.clientID;
    };

    /**
     * Return the master version for this document
     * @returns {string}
     */
    Document.prototype.getDocVersion = function() {
        var version = this.getState().v;
        if (!version) version = this.nextDocVersion();
        return version;
    };

    /**
     * Increment the document version and return it
     * @returns {string}
     */
    Document.prototype.nextDocVersion = function() {
        return this.getState().v =
            base64.nextVersion(this.getState().v, 6);
    };

    /**
     * Get the state object for a remote client
     * @param {String} clientID
     * @return {*} state object = {clientID, lastConfirmedSend, lastReceived}
     */
    Document.prototype.getClientState = function(clientID) {
        var states = this.getClientStates();
        var clientData = null;
        for (var i = 0; i < states.length; i++) {
            if (states[i].clientID === clientID) {
                clientData = states[i];
                break;
            }
        }
        if (!clientData) states.push(clientData = {
            clientID: clientID,
            // local version last confirmed as received remotely
            // we should send only newer versions than this
            lastConfirmedSend: null,
            // remote version that was last received
            // we can ignore older remote versions than this
            lastReceived: null
        });
        return clientData;
    };

    /**
     * Return an array of the remote state objects for all known clients
     * @returns {Array}
     */
    Document.prototype.getClientStates = function() {
        var state = this.getState();
        if (!state.remote) state.remote = [];
        return state.remote;
    };

    /**
     * Get updates to send to a remote client
     * @param {String} [clientID] Unique ID string for the remote client to get a delta update.
     * Leave empty to generate a universal state object containing the whole document
     * that can be synchronized against any remote client (even if never synced before)
     * @returns {*} data object to send
     */
    Document.prototype.getChanges = function(clientID) {
        var changesSince = null;
        if (clientID) {
            var clientState = this.getClientState(clientID);
            changesSince = clientState.lastConfirmedSend;
        }
        var changes = this.getChangesSince(changesSince);
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
    };

    /**
     * Merge updates from a remote client, updating the data and P2P client state
     * @param data Change data
     * @returns {*} data object to send
     */
    Document.prototype.mergeChanges = function(data) {
        // state of remote client as stored in this copy of the document
        var clientState = this.getClientState(data.sentBy);
        // state of this client as stored in the remote copy of the document
        var remoteState = null;
        for (var i = 0; i < data.clientStates.length; i++) {
            if (data.clientStates[i].clientID == this.getClientID()) {
                remoteState = data.clientStates[i];
                break;
            }
        }
        if (remoteState && (clientState.lastConfirmedSend < remoteState.lastReceived)) {
            clientState.lastConfirmedSend = remoteState.lastReceived;
        }
        var allWasSent = clientState.lastConfirmedSend === this.getDocVersion();
        // inherited, actual merging of changes
        Syncable.prototype.mergeChanges.call(this, data.changes, clientState);
        clientState.lastReceived = data.fromVersion;

        for (var j = 0; j < data.clientStates.length; j++) {
            remoteState = data.clientStates[j];
            if (remoteState.clientID != this.getClientID()) {
                var localState = this.getClientState(remoteState.clientID);
                // update remote version that was last received
                if (localState.lastReceived < remoteState.lastReceived) {
                    localState.lastReceived = remoteState.lastReceived;
                }
                // if our state matches the state of the other client
                // and their state matches the state of the third party
                // the third party has received our version already
                if (allWasSent && (data.fromVersion == remoteState.lastConfirmedSend)) {
                    localState.lastConfirmedSend = this.getDocVersion();
                }
            }
        }

        // syncing updates the local version
        // we shouldn't send updates for versions added by syncing
        if (allWasSent) {
            clientState.lastConfirmedSend = this.getDocVersion();
        }
    };

    // TODO: persistence of documents (Document.save() and minisync.open() with localStorage default implementation)

    // TODO: P2P communication mechanism (default implementation)

// Public API

    function minisync(data) {
        return new Document(data || {});
    }
    minisync.createID = uid.next;

// Private API exposed for unit tests only

    minisync._private = {
        nextVersion: base64.nextVersion,
        dateToString: dateToString,
        createLongID: uid.nextLong,
        Syncable: Syncable,
        SyncableArray: SyncableArray
    };

    scope.minisync = minisync;

})(window);
