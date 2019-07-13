(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../types"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var types_1 = require("../types");
    // remote syncing API
    // 1 MB
    var PART_SIZE_LIMIT = 1024 * 1024;
    /**
     * Saves a document to a remote store for the current client
     * @param document The document to save
     * @param store The remote store to save to
     * @param options Additional configuration options
     *
     * The remote store is organized like this:
     * - `documents/`
     *   - `document-{id}/`: all data for a specific document belonging to this store's user
     *     - `client-{id}/`; data for a specific client that the user has synced
     *       - `client-index.json`: index of data parts for this client
     *       - `part-00000XYZ.json`: a changes file for a particular range of versions uploaded by this client
     *       - `part-...`
     *    - `master-index.json`: the index for all the user's clients that have synced to this folder
     */
    function saveRemote(document, store, options) {
        // what have we stored before?
        return getClientIndex(document.getID(), document.getClientID(), store)
            .then(function (clientIndex) {
            if (!options)
                options = {};
            // if we've never written to this store for this client, create a fresh client index
            if (!clientIndex) {
                clientIndex = newClientIndex(document.getClientID(), options.clientName);
            }
            // determine the part file to write to (append latest or start new)
            // the document is chunked across multiple files to keep files reasonably sized for network transfer
            var writeToPart = clientIndex.parts.slice().pop();
            if (writeToPart.size > (options.partSizeLimit || PART_SIZE_LIMIT)) {
                writeToPart = {
                    id: writeToPart.id + 1,
                    fromVersion: writeToPart.toVersion,
                    toVersion: writeToPart.toVersion,
                    url: null,
                    size: 0
                };
                clientIndex.parts.push(writeToPart);
            }
            // write changes to the part file, if necessary (version is newer than part file)
            if (!writeToPart.fromVersion || (document.getDocVersion() > writeToPart.toVersion)) {
                writeToPart.toVersion = document.getDocVersion();
                var data = document.getChanges(writeToPart.fromVersion);
                var dataStr = JSON.stringify(data);
                writeToPart.size = dataStr.length;
                return store.putFile({
                    path: pathFor(document.getID(), document.getClientID()),
                    fileName: "part-" + types_1.padStr(String(writeToPart.id), 8) + ".json",
                    contents: dataStr
                }).then(function (success) {
                    // update the client index and master index
                    clientIndex.latest = writeToPart.toVersion;
                    clientIndex.updated = types_1.dateToString(new Date());
                    if (options.clientName)
                        clientIndex.clientName = options.clientName;
                    return store.putFile({
                        path: pathFor(document.getID(), clientIndex.clientID),
                        fileName: "client-index.json",
                        contents: JSON.stringify(clientIndex)
                    }).then(function () { return updateMasterIndex(document, clientIndex, store); }).then(function () { return clientIndex; });
                });
            }
            else
                return clientIndex;
        });
    }
    exports.saveRemote = saveRemote;
    /**
     * Create a document by restoring it from the latest version in a store
     * @param documentID The document's ID
     * @param store The remote store to fetch it from
     */
    function createFromRemote(documentID, store) {
        // TODO: implement createFromRemote
        return null;
    }
    exports.createFromRemote = createFromRemote;
    /**
     * Merge changes from this user's other clients in a remote store
     * @param document The documet to merge changes into
     * @param store The store to merge changes from
     * @return The document with the changes applied to it
     */
    function mergeFromRemoteClients(document, store) {
        // TODO: implement mergeRemoteClients
        // get master index to find a list of our clients
        // filter to those clients we need to sync with (are newer than we've synced with)
        // for every client, obtain the parts files and merge them into the document
        // update the list of peers in the document
        return Promise.resolve(document);
    }
    exports.mergeFromRemoteClients = mergeFromRemoteClients;
    /**
     * Merge changes from other users
     * @param document The document to merge changes into
     * @param allStores All stores that can be used to download changes from other users
     */
    function mergeFromRemotePeers(document, allStores) {
        // TODO: implement mergeRemotePeers
        // construct the list of peers to obtain changes from
        // filter to those peers we need to sync with (are newer than we've synced with)
        // for every peer, obtain the parts files and merge them into the document
        return Promise.resolve(document);
    }
    exports.mergeFromRemotePeers = mergeFromRemotePeers;
    function getMasterIndex(documentID, store) {
        return store.getFile({
            path: pathFor(documentID),
            fileName: "master-index.json"
        }).then(function (file) {
            return parseJsonAs(file, "MASTER-INDEX" /* MasterIndex */);
        });
    }
    exports.getMasterIndex = getMasterIndex;
    function updateMasterIndex(document, clientIndex, store) {
        return getMasterIndex(document.getID(), store)
            .then(function (masterIndex) {
            // if we've never written to this store for this client, create a fresh client index
            if (!masterIndex) {
                masterIndex = newMasterIndex(document);
            }
            // update this client's info in the master index
            masterIndex.clients[clientIndex.clientID] = {
                url: null,
                version: clientIndex.latest,
                label: clientIndex.clientName
            };
            masterIndex.latestUpdate = clientIndex.clientID;
            return store.putFile({
                path: pathFor(document.getID()),
                fileName: "master-index.json",
                contents: JSON.stringify(masterIndex)
            }).then(function () { return masterIndex; });
        });
    }
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
        if (file === null)
            return null;
        var result = JSON.parse(file.contents);
        if (!fileKnownAs(result, dataType)) {
            switch (dataType) {
                case "CLIENT-INDEX" /* ClientIndex */:
                    throw errorFor(file, "not a client index file");
                case "MASTER-INDEX" /* MasterIndex */:
                    throw errorFor(file, "not a master index file");
                default:
                    throw errorFor(file, "unrecognized type: " + dataType);
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
    function newClientIndex(clientID, clientName) {
        return {
            _minisync: {
                dataType: "CLIENT-INDEX" /* ClientIndex */,
                version: 1
            },
            latest: null,
            updated: null,
            clientID: clientID,
            clientName: clientName,
            parts: [{
                    id: 0,
                    fromVersion: null,
                    toVersion: null,
                    url: null,
                    size: 0
                }]
        };
    }
    function newMasterIndex(document) {
        return {
            _minisync: {
                dataType: "MASTER-INDEX" /* MasterIndex */,
                version: 1
            },
            label: null,
            clients: {},
            peers: {},
            latestUpdate: null
        };
    }
});
//# sourceMappingURL=remote.js.map