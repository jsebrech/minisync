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
    // TODO: publish/subscribe document from remoteStore
    // remote synccing API
    function saveRemote(document, store) {
        return null;
    }
    exports.saveRemote = saveRemote;
    function restoreRemote(id, store) {
        return null;
    }
    exports.restoreRemote = restoreRemote;
    function getMasterIndex(documentID, store) {
        return store.getFile({
            path: pathFor(documentID),
            fileName: "master-index.json"
        }).then(function (file) {
            return parseJsonAs(file, "MASTER-INDEX" /* MasterIndex */);
        });
    }
    exports.getMasterIndex = getMasterIndex;
    function getClientIndex(documentID, clientID, store) {
        return store.getFile({
            path: pathFor(documentID, clientID),
            fileName: "client-index.json"
        }).then(function (file) {
            return parseJsonAs(file, "CLIENT-INDEX" /* ClientIndex */);
        });
    }
    exports.getClientIndex = getClientIndex;
    function fileKnownAs(json, dataType) {
        return (json && json._minisync && (json._minisync.dataType === dataType));
    }
    function parseJsonAs(file, dataType) {
        var result = JSON.parse(file.contents);
        if (!fileKnownAs(result, dataType)) {
            switch (dataType) {
                case "CLIENT-INDEX" /* ClientIndex */:
                    throw errorFor(file, "not a client index file");
                case "MASTER-INDEX" /* MasterIndex */:
                    throw errorFor(file, "not a master index file");
                default:
                    throw errorFor(file, "unrecognied type: " + dataType);
            }
        }
        return result;
    }
    function pathFor(documentID, clientID) {
        var path = ["documents", "document-" + documentID];
        if (clientID) {
            path.push("client-" + clientID);
        }
        return path;
    }
    function errorFor(handle, message) {
        return new Error("Error at " +
            handle.path.concat(handle.fileName).filter(function (s) { return s; }).join("/") +
            (message ? ": " + message : ""));
    }
});
//# sourceMappingURL=remote.js.map