(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports", "./base64", "./document", "./syncable", "./types", "./uid"], factory);
    }
})(function (require, exports) {
    "use strict";
    var base64 = require("./base64");
    var document_1 = require("./document");
    var syncable_1 = require("./syncable");
    var types_1 = require("./types");
    var uid = require("./uid");
    // TODO: P2P communication mechanism (default implementation)
    // TODO: events for remote changes
    // Public API
    function from(data, restore) {
        return new document_1.Document(data || {}, restore);
    }
    exports.from = from;
    function createID() {
        return uid.next();
    }
    exports.createID = createID;
    function restore(data) {
        return new document_1.Document(data || {}, true);
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