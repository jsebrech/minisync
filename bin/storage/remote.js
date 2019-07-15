var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
                }).then(function (handle) { return store.publishFile(handle); }).then(function (publishedUrl) {
                    writeToPart.url = publishedUrl;
                    // update the client index and master index
                    clientIndex.latest = writeToPart.toVersion;
                    clientIndex.updated = types_1.dateToString(new Date());
                    if (options.clientName)
                        clientIndex.clientName = options.clientName;
                    return store.putFile({
                        path: pathFor(document.getID(), clientIndex.clientID),
                        fileName: "client-index.json",
                        contents: JSON.stringify(clientIndex)
                    }).then(function (handle) { return store.publishFile(handle); }).then(function (url) { return updateMasterIndex(document, clientIndex, url, store); }).then(function () { return clientIndex; });
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
        return Promise.reject(new Error("not yet implemented"));
    }
    exports.createFromRemote = createFromRemote;
    /**
     * Merge changes from this user's other clients in a remote store
     * @param document The documet to merge changes into (this is modified by this operation!)
     * @param store The store to merge changes from
     * @return The document after the changes are applied to it
     */
    function mergeFromRemoteClients(document, store) {
        return __awaiter(this, void 0, void 0, function () {
            var masterIndex, clientStates, clients, changes, _i, changes_1, change, _a, _b, part;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, getMasterIndex(document.getID(), store)];
                    case 1:
                        masterIndex = _c.sent();
                        clientStates = document.getClientStates();
                        clients = Object.entries(masterIndex.clients).filter(function (_a) {
                            var clientID = _a[0], client = _a[1];
                            var previous = clientStates.find(function (s) { return s.clientID === clientID; });
                            return !previous || (previous.lastReceived < client.lastReceived);
                        }).map(function (v) { return v[0]; });
                        return [4 /*yield*/, Promise.all(
                            // fetch in parallel
                            clients.map(function (clientID) { return __awaiter(_this, void 0, void 0, function () {
                                var clientIndex, previous, parts, files;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, getClientIndex(document.getID(), clientID, store)];
                                        case 1:
                                            clientIndex = _a.sent();
                                            previous = clientStates.find(function (s) { return s.clientID === clientIndex.clientID; });
                                            parts = clientIndex.parts.filter(function (part) { return (!previous) || (previous.lastReceived < part.toVersion); });
                                            return [4 /*yield*/, Promise.all(
                                                // fetch in parallel
                                                parts.map(function (part) { return store.getFile({
                                                    path: pathFor(document.getID(), clientID),
                                                    fileName: "part-" + types_1.padStr(String(part.id), 8) + ".json"
                                                }); }))];
                                        case 2:
                                            files = _a.sent();
                                            // for this client, we must merge these change parts
                                            return [2 /*return*/, {
                                                    clientIndex: clientIndex,
                                                    parts: files
                                                }];
                                    }
                                });
                            }); }))];
                    case 2:
                        changes = _c.sent();
                        // merge all the parts into the document, sequentially by client, and then by part
                        for (_i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
                            change = changes_1[_i];
                            for (_a = 0, _b = change.parts; _a < _b.length; _a++) {
                                part = _b[_a];
                                document.mergeChanges(JSON.parse(part.contents));
                            }
                        }
                        return [2 /*return*/, document];
                }
            });
        });
    }
    exports.mergeFromRemoteClients = mergeFromRemoteClients;
    /**
     * Merge changes from other users
     * @param document The document to merge changes into (this is modified by this operation!)
     * @param allStores All stores that can be used to download changes from other users
     * @return The document after the changes are applied to it
     */
    function mergeFromRemotePeers(document, allStores) {
        // TODO: implement mergeFromRemotePeers
        // construct the list of peers to obtain changes from
        // filter to those peers we need to sync with (are newer than we've synced with)
        // for every peer, obtain the parts files and merge them into the document
        return Promise.reject(new Error("not yet implemented"));
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
    function updateMasterIndex(document, clientIndex, clientIndexUrl, store) {
        return getMasterIndex(document.getID(), store)
            .then(function (masterIndex) {
            // if we've never written to this store for this client, create a fresh client index
            if (!masterIndex) {
                masterIndex = newMasterIndex(document);
            }
            // update this client's info in the master index
            masterIndex.clients[clientIndex.clientID] = {
                url: clientIndexUrl,
                lastReceived: clientIndex.latest,
                label: clientIndex.clientName
            };
            masterIndex.latestUpdate = {
                clientID: clientIndex.clientID,
                updated: clientIndex.updated
            };
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
            peers: [],
            latestUpdate: null
        };
    }
});
//# sourceMappingURL=remote.js.map