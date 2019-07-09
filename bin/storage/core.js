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
    /**
     * Save a document to a local store
     * @param document Document to aave
     * @param store The store to save to
     * @return The document's ID (to restore from)
     */
    function saveLocal(document, store) {
        return store.putFile({
            path: ["documents"],
            fileName: document.getID() + ".json",
            contents: JSON.stringify(document.getChanges())
        }).then(function (success) {
            if (!success)
                throw new Error("Unexpected error saving document");
            return document.getID();
        });
    }
    exports.saveLocal = saveLocal;
    /**
     * Restore a document from a local store
     * @param id The document id to restore
     * @param store The store to restore from
     * @return The restored document
     */
    function restoreLocal(id, store) {
        return store.getFile({
            path: ["documents"],
            fileName: id + ".json"
        }).then(function (data) {
            return minisync.restore(JSON.parse(data.contents));
        });
    }
    exports.restoreLocal = restoreLocal;
});
//# sourceMappingURL=core.js.map