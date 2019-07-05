(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./document", "./uid"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var document_1 = require("./document");
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
});
//# sourceMappingURL=minisync.js.map