(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./minisync"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var minisync_1 = require("./minisync");
    var LocalStoragePlugin = (function () {
        function LocalStoragePlugin(prefix) {
            if (prefix === void 0) { prefix = "minisync"; }
            this.prefix = prefix;
        }
        LocalStoragePlugin.prototype.getFile = function (file) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var stored = window.localStorage.getItem(_this.prefix + "//" + _this.encode(file));
                if (stored === null) {
                    reject(new Error("No such file: " + _this.encode(file)));
                }
                else {
                    resolve({
                        path: file.path,
                        fileName: file.fileName,
                        contents: stored
                    });
                }
            });
        };
        LocalStoragePlugin.prototype.putFile = function (file) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                window.localStorage.setItem(_this.prefix + "//" + _this.encode(file), file.contents);
                resolve(true);
            });
        };
        LocalStoragePlugin.prototype.getFiles = function (files) {
            return Promise.all(files.map(this.getFile, this));
        };
        LocalStoragePlugin.prototype.listFiles = function (path) {
            var internalPath = this.prefix + "//" + path.join("/") + "/";
            return Promise.resolve(this.allKeys().filter(function (key) {
                return key.indexOf(internalPath) === 0;
            }).map(function (key) {
                return {
                    path: path,
                    fileName: key.substr(internalPath.length)
                };
            }));
        };
        LocalStoragePlugin.prototype.allKeys = function () {
            var result = [];
            for (var i = 0, len = localStorage.length; i < len; ++i) {
                result.push(localStorage.key(i));
            }
            return result;
        };
        LocalStoragePlugin.prototype.encode = function (what) {
            if (typeof what === "object") {
                return this.encode(what.path.join("/") + "/" + what.fileName);
            }
            else
                return what;
        };
        return LocalStoragePlugin;
    }());
    exports.LocalStoragePlugin = LocalStoragePlugin;
    var Storage = (function () {
        function Storage(
            /** the namespace inside of which documents are stored */
            namespace, 
            /** The storage plugin used for saving local copies of the document */
            localStore) {
            if (namespace === void 0) { namespace = "minisync"; }
            if (localStore === void 0) { localStore = new LocalStoragePlugin(namespace); }
            this.namespace = namespace;
            this.localStore = localStore;
        }
        /**
         * Save a document to local storage
         * @param document Document to aave
         * @return The document's ID (to restore from)
         */
        Storage.prototype.save = function (document) {
            return this.localStore.putFile({
                path: ["documents"],
                fileName: document.getID(),
                contents: JSON.stringify(document.getChanges())
            }).then(function (success) {
                if (!success)
                    throw new Error("Unexpected error saving document");
                return document.getID();
            });
        };
        /**
         * Restore a document from local storage
         * @param id The document id to restore
         * @return The restored document
         */
        Storage.prototype.restore = function (id) {
            return this.localStore.getFile({
                path: ["documents"],
                fileName: id
            }).then(function (data) {
                return minisync_1.restore(JSON.parse(data.contents));
            });
        };
        return Storage;
    }());
    exports.Storage = Storage;
});
// TODO: indexeddb backend
// TODO: implement dropbox plugin
// TODO: publish/subscribe document from remoteStore
//# sourceMappingURL=storage.js.map