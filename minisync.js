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
            // base64.encodeFloat needs a 48 bit number to get 8 chars
            while(true) {
                // seconds = 32 bits (until 2038), 33 bits afterwards
                // Seconds ensures low risk of collisions across time.
                var seconds = Math.floor((new Date()).getTime() / 1000);
                if (seconds !== lastUid.at) {
                    lastUid = { at: seconds, uids: [] };
                }
                // 15 bits of randomness
                // random ensures low risk of collision inside a seconds
                var random =
                    Math.floor(Math.random() * Math.pow(2, 32)) &
                    (Math.pow(2, 15) - 1);
                // uid = 15 bits of random + 32/33 bits of time
                var uid = (random * Math.pow(2, 32)) + seconds;
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

    // Array.forEach polyfill
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Polyfill
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function(callback, thisArg) {
            var T, k;
            if (this == null) {
                throw new TypeError(' this is null or not defined');
            }
            // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
            var O = Object(this);
            // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;
            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if (typeof callback !== "function") {
                throw new TypeError(callback + ' is not a function');
            }
            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if (arguments.length > 1) {
                T = thisArg;
            }
            // 6. Let k be 0
            k = 0;
            // 7. Repeat, while k < len
            while (k < len) {
                var kValue;
                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                if (k in O) {
                    // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                    kValue = O[k];
                    // ii. Call the Call internal method of callback with T as the this value and
                    // argument list containing kValue, k, and O.
                    callback.call(T, kValue, k, O);
                }
                // d. Increase k by 1.
                k++;
            }
            // 8. return undefined
        };
    }

// Synchronizable object classes

    /**
     * Syncable class constructor, wraps one synchronizing object in a document
     * @param document The master document this is linked to
     * @param data The data object it wraps
     * @param restore True if restoring from changes object
     * @constructor
     */
    function Syncable(document, data, restore) {
        this.setDocument(document);
        this.setData(data, restore);
    }

    function makeSyncable(document, data, restore) {
        var restoringArray = restore && data && data._s && data._s.a;
        if (isArray(data) || restoringArray) {
            return new SyncableArray(document, data, restore);
        } else if ((typeof data == 'object') && !(data instanceof Syncable)) {
            return new Syncable(document, data, restore);
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
     * @param restore If true, we are restoring from a saved changes object
     * @internal
     */
    Syncable.prototype.setData = function(data, restore) {
        this.data = data;
        // make sure the state is initialized in the data object
        if (this.data) this.getState();
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
     * @param [ifRemoved] also return it if it was removed
     * @returns {Syncable|SyncableArray}
     */
    Syncable.prototype.get = function(key, ifRemoved) {
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
        if ((value instanceof Syncable) && value.isRemoved() && !ifRemoved) value = null;
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
                var value = this.get(key, true);
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
     * @protected
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
              ( (this.getVersion() <= clientState.lastAcknowledged) ||
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
        // if the other was removed, remove it here also,
        // even if the local value is newer
        var otherIsRemoved = changes._s && changes._s.r;
        if (otherIsRemoved) this.remove();
    };

    /**
     * Syncable Array class constructor, wraps one synchronizing array in a document
     * @param document The master document this is linked to
     * @param data The data array it wraps
     * @param restore Whether we are restoring from a changes object
     * @constructor
     */
    function SyncableArray(document, data, restore) {
        if (restore) {
            Syncable.call(this, document, data.v, restore);
            this.data._s = data._s;
        } else {
            if (!isArray(data)) data = [];
            Syncable.call(this, document, data, restore);
        }
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
         */

        if (changes && changes._s && isArray(changes.v)) {
            // remove items that were removed remotely
            if (isArray(changes._s.ri)) {
                changes._s.ri.forEach(function(removed) {
                    this.forEach(function (value, index) {
                        if (value && value.getID && (value.getID() === removed.id)) {
                            this.splice(index, 1);
                        }
                    }, this);
                }, this);
            }

            // maps value id to index
            var localIDs = this.getIdMap();
            var remoteIDs = {};

            // synchronize all value objects present in both local and remote
            changes.v.forEach(function(remoteValue, remoteIndex) {
                if (remoteValue && remoteValue._s) {
                    remoteIDs[remoteValue._s.id] = remoteIndex;
                    var localIndex = localIDs[remoteValue._s.id];
                    if (localIndex !== undefined) {
                        var localValue = this.get(localIDs[remoteValue._s.id]);
                        localValue.mergeChanges(remoteValue, clientState);
                    }
                }
            }, this);

            // the remote version of the array is newer than the last received
            var remoteChanged = (changes._s.u > clientState.lastReceived);
            if (remoteChanged) {
                var sortedData = this.sortByRemote(changes.v);
                this.data.splice.apply(this.data, [0, this.data.length].concat(sortedData));

                var otherIsNewer =
                    ( remoteChanged &&
                        // and the local data version is older the last local document version
                        // that was acknowledged by the remote (no conflict)
                        ( (this.getVersion() <= clientState.lastAcknowledged) ||
                            // or the remote timestamp is not older than the local timestamp
                            // (conflict solved in favor of remote value)
                            (changes._s.t >= this.getTimeStamp())
                            )
                        );

                var createIntervals = function (changes, localIDs) {
                    var localValue, remoteValue;
                    // remote values in between objects that exist on both sides
                    var intervals = [];
                    var interval = [];
                    var lastID = null;
                    var v = changes.v || [];
                    // synchronize the objects that exist on both sides
                    for (var i = 0; i < v.length; i++) {
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
                var intervals = createIntervals.call(this, changes, localIDs);

                // synchronize the intervals between the objects that exist on both sides
                if (otherIsNewer) {
                    while (intervals.length) {
                        this.mergeInterval(intervals.shift());
                    }
                }
            }
        }
    };

    /**
     * Sort the local data array based on the sorting order of the remote array
     * Does not update the local data.
     * @param remote Array of remote data
     * @return Array The sorted data
     */
    SyncableArray.prototype.sortByRemote = function(remote) {
        var data = this.data;
        if (!isArray(remote)) return data;
        var localIDs = this.getIdMap();
        // construct map of remote object ID's that also exist locally
        var sharedIDs = [];
        remote.forEach(function(remoteValue) {
            if (!remoteValue || !remoteValue._s) return;
            if (!localIDs[remoteValue._s.id]) return;
            sharedIDs.push(remoteValue._s.id);
        }, this);
        // split local array into chunks
        var chunks = [], chunk = [];
        data.forEach(function(localValue) {
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
        chunks.sort(function(a, b) {
            // only the first chunk can be empty, so it always sorts first
            if (!a.length) return -1;
            if (!b.length) return 1;
            var aPos = sharedIDs.indexOf(a[0]._s.id);
            var bPos = sharedIDs.indexOf(b[0]._s.id);
            if (aPos === bPos) return 0;
            return aPos < bPos ? -1 : 1;
        });
        // concatenate chunks
        data = [];
        data = data.concat.apply(data, chunks);
        return data;
    };

    /**
     * Merge a remote interval (= array of values) into a local range
     * @param {object} interval
     * A range between two syncable objects, null as id to specify array start/end
     * { after: string = id, before: string = id, data: array }
     */
    SyncableArray.prototype.mergeInterval = function(interval) {
        var start = interval.after ? (this.indexOf(interval.after, 0, true)+1) : 0;
        var end = interval.before ? this.indexOf(interval.before, 0, true) : this.length();
        var local = this.slice(start, end);
        var values = [].concat(interval.values);
        local.forEach(function(value) {
            if (value && value._s) values.push(value);
        });
        Array.prototype.splice.apply(this.data, [start, end - start].concat(values));
    };

    /**
     * Returns object mapping value object id to index in array where it is found
     * @return object
     */
    SyncableArray.prototype.getIdMap = function() {
        var i, localValue;
        // build index mapping local object id's to positions
        var localIDs = {};
        for (i = 0; i < this.length(); i++) {
            localValue = this.get(i);
            if (localValue instanceof Syncable) {
                localIDs[localValue.getID()] = i;
            }
        }
        return localIDs;
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
     * @param restore If true, create this document as the client that generated the changes object
     * @constructor Document
     */
    function Document(data, restore) {
        if (typeof data != 'object') throw 'Argument must be an object';
        if (isArray(data)) throw 'Argument cannot be an array';
        var isChanges =
            data && data._minisync && (data._minisync.dataType == 'CHANGES');
        if (isChanges && data.changesSince) throw 'change block must be non-delta';
        var shouldMerge = isChanges && !restore;
        var shouldRestore = isChanges && restore;
        if (shouldMerge) {
            Syncable.call(this, this, {});
            // ensure an initial state exists
            this.getDocVersion();
            this.mergeChanges(data);
            // for all client states, mark last confirmed send as current version
            var clientStates = this.getClientStates();
            for (var i = 0; i < clientStates.length; i++) {
                var clientState = clientStates[i];
                clientState.lastAcknowledged = this.getDocVersion();
            }
        } else if (shouldRestore) {
            Syncable.call(this, this, data.changes, true);
            this.setClientID(data.sentBy);
            this.setDocVersion(data.fromVersion);
            this.setClientStates(data.clientStates);
        } else { // first init from raw data
            Syncable.call(this, this, data);
            // ensure an initial state exists
            this.getDocVersion();
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
     * Change the unique client ID of the document on this machine
     * @param {string} id
     * @internal
     */
    Document.prototype.setClientID = function(id) {
        this.getState().clientID = id;
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
     * Set the version of this document to a different one
     * @param {string} v
     * @internal
     */
    Document.prototype.setDocVersion = function(v) {
        this.getState().v = v;
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
     * @return {*} state object = {clientID, lastAcknowledged, lastReceived}
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
            lastAcknowledged: null,
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
     * Set a new array of remote client states
     * @param states
     * @internal
     */
    Document.prototype.setClientStates = function(states) {
        var state = this.getState();
        state.remote = states || [];
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
            changesSince = clientState.lastAcknowledged;
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
        if (remoteState && (clientState.lastAcknowledged < remoteState.lastReceived)) {
            clientState.lastAcknowledged = remoteState.lastReceived;
        }
        var allWasSent = clientState.lastAcknowledged === this.getDocVersion();
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
    };

    // TODO: P2P communication mechanism (default implementation)

// Public API

    function minisync(data) {
        return new Document(data || {});
    }
    minisync.createID = uid.next;
    minisync.restore = function(data) {
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

    scope.minisync = minisync;

})(window);
