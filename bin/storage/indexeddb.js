(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var objectStore1 = "files";
    function request2promise(req, tr) {
        if (tr === void 0) { tr = null; }
        var result;
        return new Promise(function (resolve, reject) {
            req.onerror = function (e) {
                // prevent global error throw https://bugzilla.mozilla.org/show_bug.cgi?id=872873
                if (typeof e.preventDefault === "function")
                    e.preventDefault();
                reject(e.target.error);
            };
            req.onsuccess = function (e) {
                result = e.target.result;
                if (!tr)
                    resolve(result);
            };
            if (tr)
                tr.oncomplete = function () { return resolve(result); };
        });
    }
    var IndexedDBStore = /** @class */ (function () {
        /** database with name prefix will be used */
        function IndexedDBStore(prefix) {
            if (prefix === void 0) { prefix = "minisync"; }
            this.prefix = prefix;
            if (!IndexedDBStore.canUseIDB())
                throw new Error("IndexedDB not supported here");
        }
        /**
         * Return a handle to the indexeddb factory object
         */
        IndexedDBStore.getIDB = function () {
            try {
                if (typeof indexedDB !== "undefined")
                    return indexedDB;
            }
            catch (e) { /* ignore */ }
            return undefined;
        };
        /**
         * Return true if indexeddb can be used on this machine
         * @see https://github.com/localForage/localForage/blob/master/src/utils/isIndexedDBValid.js
         */
        IndexedDBStore.canUseIDB = function () {
            if (!this.getIDB())
                return false;
            // IE mobile advertises itself as safari, test for openDatabase to check for real safari
            var isSafari = typeof openDatabase !== "undefined" &&
                /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) &&
                !/Chrome/.test(navigator.userAgent) &&
                !/BlackBerry/.test(navigator.platform);
            var hasFetch = typeof fetch === "function" &&
                fetch.toString().indexOf("[native code") !== -1;
            // Safari <10.1 has many IDB issues
            // 10.1 shipped with fetch, use to detect it
            return (!isSafari || hasFetch) &&
                // some outdated implementations of IDB that appear on Samsung
                // and HTC Android devices <4.4 are missing IDBKeyRange
                typeof IDBKeyRange !== "undefined";
        };
        IndexedDBStore.prototype.getFile = function (file) {
            var _this = this;
            return this.openDB().then(function (db) {
                return request2promise(db.transaction(objectStore1)
                    .objectStore(objectStore1)
                    .get(_this.handleToKey(file))).then(function (s) { return s.file; });
            });
        };
        IndexedDBStore.prototype.putFile = function (file) {
            var _this = this;
            return this.openDB().then(function (db) {
                return request2promise(db.transaction(objectStore1, "readwrite")
                    .objectStore(objectStore1)
                    .put({
                    name: file.fileName,
                    path: file.path.join("/"),
                    file: file
                }, _this.handleToKey(file))).then(function (s) { return true; });
            });
        };
        IndexedDBStore.prototype.getFiles = function (files) {
            var _this = this;
            return Promise.all(files.map(function (file) { return _this.getFile(file); }));
        };
        IndexedDBStore.prototype.listFiles = function (path) {
            return this.openDB().then(function (db) {
                return db.transaction(objectStore1)
                    .objectStore(objectStore1)
                    .index("path");
            }).then(function (index) {
                return new Promise(function (resolve, reject) {
                    var pathStr = path.join("/");
                    var results = [];
                    var req = index.openKeyCursor(IDBKeyRange.only(pathStr));
                    req.onsuccess = function (e) {
                        var cursor = e.target.result;
                        if (cursor) {
                            results.push({
                                path: path,
                                fileName: cursor.key.substr(pathStr.length + 1)
                            });
                            // will fire onsuccess again for next match
                            cursor.continue();
                        }
                        else {
                            // no more entries, search is done
                            resolve(results);
                        }
                    };
                    req.onerror = function (e) {
                        resolve(results);
                    };
                });
            });
        };
        IndexedDBStore.prototype.openDB = function () {
            var _this = this;
            return new Promise(function (resolve, reject) {
                if (_this.db) {
                    resolve(_this.db);
                }
                else {
                    // initial db version is 1, request upgrade to version 2 to create the object store
                    var req_1 = IndexedDBStore.getIDB().open(_this.prefix, 1);
                    req_1.onupgradeneeded = function (e) {
                        if (e.newVersion === 1) {
                            var db = req_1.result;
                            var store = db.createObjectStore(objectStore1);
                            store.createIndex("path", "path", { unique: false });
                        }
                    };
                    req_1.onsuccess = function (e) {
                        _this.db = e.target.result;
                        resolve(_this.db);
                    };
                    req_1.onerror = function (e) {
                        reject(e);
                    };
                }
            });
        };
        // Convert a FileHandle to an IndexedDB store key.
        IndexedDBStore.prototype.handleToKey = function (handle) {
            return handle.path.join("/") + "/" + handle.fileName;
        };
        return IndexedDBStore;
    }());
    exports.IndexedDBStore = IndexedDBStore;
});
//# sourceMappingURL=indexeddb.js.map