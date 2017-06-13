(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./base64", "./document", "./syncable", "./types", "./uid"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var base64 = require("./base64");
    var document_1 = require("./document");
    var syncable_1 = require("./syncable");
    var types_1 = require("./types");
    var uid = require("./uid");
    // TODO: P2P communication mechanism (default implementation)
    // Public API
    /**
     * Create a minisync Document from a raw object or minisync changes object (bootstraps a new client)
     * @param data The changes object to reconstruct from, or the raw object to create a new Document for
     * @param restore For changes objects, if true retores the Document to memory (as the client that exported the changes)
     * @return The minisync Document
     */
    function from(data, restore) {
        return new document_1.Document(data || {}, restore);
    }
    exports.from = from;
    /**
     * Create a unique client identifier.
     * @return The client identifier
     */
    function createID() {
        return uid.next();
    }
    exports.createID = createID;
    /**
     * Restore a Document from a changes object (as the client that created it)
     * @param data A complete changes object generated with document.getChanges
     * @return The minisync Document
     */
    function restore(data) {
        return from(data, true);
    }
    exports.restore = restore;
    // Private API exposed for unit tests only
    exports._private = {
        nextVersion: base64.nextVersion,
        dateToString: types_1.dateToString,
        createLongID: uid.nextLong,
        Syncable: syncable_1.Syncable,
        SyncableArray: syncable_1.SyncableArray
    };
});
//# sourceMappingURL=minisync.js.map