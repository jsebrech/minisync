(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../minisync"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var minisync = require("../minisync");
    /** Syncing documents to device-local stores */
    var LocalSync = /** @class */ (function () {
        function LocalSync(store) {
            this.store = store;
        }
        /**
         * Save a document to a local store
         * @param document Document to aave
         * @param store The store to save to
         * @return The document's ID (to restore from)
         */
        LocalSync.prototype.saveLocal = function (document) {
            return this.store.putFile({
                path: ["documents"],
                fileName: document.getID() + ".json",
                contents: JSON.stringify(document.getChanges())
            }).then(function (handle) {
                if (!handle)
                    throw new Error("Unexpected error saving document");
                return document.getID();
            });
        };
        /**
         * Restore a document from a local store
         * @param id The document id to restore
         * @param store The store to restore from
         * @return The restored document
         */
        LocalSync.prototype.restoreLocal = function (id) {
            return this.store.getFile({
                path: ["documents"],
                fileName: id + ".json"
            }).then(function (data) {
                return minisync.restore(JSON.parse(data.contents));
            });
        };
        return LocalSync;
    }());
    exports.LocalSync = LocalSync;
});
//# sourceMappingURL=local.js.map