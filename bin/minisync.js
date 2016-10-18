(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports", "./syncable", "./document", "./types", "./uid", "./base64"], factory);
    }
})(function (require, exports) {
    "use strict";
    var syncable_1 = require("./syncable");
    var document_1 = require("./document");
    var types_1 = require("./types");
    var uid = require("./uid");
    var base64 = require("./base64");
    // TODO: P2P communication mechanism (default implementation)
    // TODO: Proxy object
    // TODO: events for remote changes
    // Public API
    function from(data, restore) {
        return new document_1["default"](data || {}, restore);
    }
    exports.from = from;
    function createID() {
        return uid.next();
    }
    exports.createID = createID;
    function restore(data) {
        return new document_1["default"](data || {}, true);
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