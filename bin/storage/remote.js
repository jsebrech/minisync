var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
        define(["require", "exports", "../document", "../logging", "../types"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var document_1 = require("../document");
    var logging_1 = require("../logging");
    var types_1 = require("../types");
    // 1 MB
    var DEFAULT_PART_SIZE_LIMIT = 1024 * 1024;
    /**
     * Syncing documents to remote stores
     */
    var RemoteSync = /** @class */ (function () {
        function RemoteSync(
        /** the default store where we store documents */
        store, 
        /** the stores through which documents from peers are downloaded */
        allStores, 
        /** the logger used for error and debug logging */
        logger) {
            if (allStores === void 0) { allStores = [store]; }
            if (logger === void 0) { logger = logging_1.defaultLogger(); }
            this.store = store;
            this.allStores = allStores;
            this.logger = logger;
        }
        /**
         * Saves a document to a remote store for the current client (if changed)
         * @param document The document to save
         * @param options Additional configuration options
         * @return the updated client index in case data was saved, null otherwise
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
        RemoteSync.prototype.saveRemote = function (document, options) {
            var _this = this;
            // what have we stored before?
            this.logger.debug("saveRemote - saving document " + document.getID() + "...");
            return this.getClientIndex(document.getID(), document.getClientID())
                .then(function (clientIndex) {
                if (!options)
                    options = {};
                var onProgress = function (p) {
                    _this.logger.debug("saveRemote - " + Math.round(p * 100) + "% complete");
                    (options.onProgress || defaultProgress)(p);
                };
                onProgress(0.2); // 1 of 5 calls made
                // if we've never written to this store for this client, create a fresh client index
                if (!clientIndex) {
                    clientIndex = newClientIndex(document.getClientID(), options.clientName);
                }
                // determine the part file to write to (append latest or start new)
                // the document is chunked across multiple files to keep files reasonably sized for network transfer
                var writeToPart = clientIndex.parts.slice().pop();
                if (writeToPart.size > (options.partSizeLimit || DEFAULT_PART_SIZE_LIMIT)) {
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
                    return _this.store.putFile({
                        path: pathFor(document.getID(), document.getClientID()),
                        fileName: "part-" + types_1.padStr(String(writeToPart.id), 8) + ".json",
                        contents: dataStr
                    }).then(function (remotePartFile) { return __awaiter(_this, void 0, void 0, function () {
                        var clientIndexFile, masterIndexFile;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    onProgress(0.4); // 2 of 5 calls
                                    writeToPart.url = remotePartFile.url;
                                    // update the client index and master index
                                    clientIndex.latest = writeToPart.toVersion;
                                    clientIndex.updated = types_1.dateToString(new Date());
                                    if (options.clientName)
                                        clientIndex.clientName = options.clientName;
                                    return [4 /*yield*/, this.store.putFile({
                                            path: pathFor(document.getID(), clientIndex.clientID),
                                            fileName: "client-index.json",
                                            contents: JSON.stringify(clientIndex)
                                        })];
                                case 1:
                                    clientIndexFile = _a.sent();
                                    onProgress(0.6); // 3 of 5 calls made
                                    return [4 /*yield*/, this.updateMasterIndex(document, clientIndex, clientIndexFile.url, this.store)];
                                case 2:
                                    masterIndexFile = _a.sent();
                                    this.logger.debug("saveRemote - saved changes for document " + document.getID());
                                    return [2 /*return*/, __assign(__assign({}, clientIndex), { url: clientIndexFile.url, masterIndexUrl: masterIndexFile.url })];
                            }
                        });
                    }); });
                }
                else {
                    _this.logger.debug("saveRemote - no changes to write for document " + document.getID());
                    return null;
                }
            });
        };
        /**
         * Create a document by restoring it from the latest version in a store
         * @param documentID The document's ID
         * @param forClientID Instead of restoring the latest version as a new client,
         * restore as this client ID from that client's remote version
         */
        RemoteSync.prototype.createFromRemote = function (documentID, forClientID) {
            var _this = this;
            // get our master index
            return this.getMasterIndex(documentID)
                // and find the right client's index
                .then(function (masterIndex) {
                return _this.getClientIndex(documentID, forClientID || masterIndex.latestUpdate.clientID);
            })
                // get that client's data parts (changes object files)
                .then(function (clientIndex) { return __awaiter(_this, void 0, void 0, function () {
                var files;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, Promise.all(
                            // fetch in parallel
                            clientIndex.parts.map(function (part) { return _this.store.getFile({
                                path: pathFor(documentID, clientIndex.clientID),
                                fileName: "part-" + types_1.padStr(String(part.id), 8) + ".json"
                            }).then(function (file) { return file.contents; }); }))];
                        case 1:
                            files = _a.sent();
                            // for this client, we must merge these change parts
                            return [2 /*return*/, {
                                    clientIndex: clientIndex,
                                    parts: files
                                }];
                    }
                });
            }); })
                // and reconstruct a document from those parts
                .then(function (changes) { return documentFromClientData(changes, forClientID); });
        };
        /**
         * Create a document by restoring it from a remote url (of a master index file)
         * @param url The URL of the master index to restore from
         * @return A promise for a new Document instance, which is rejected if it is unable to restore from that url
         */
        RemoteSync.prototype.createFromUrl = function (url) {
            return __awaiter(this, void 0, void 0, function () {
                var store, masterIndex, client_1, clientIndex, files;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, Promise.all(
                            // call out to the stores in parallel to figure out which one can download this
                            this.allStores.map(function (store) { return ({ store: store, canDownload: store.canDownloadUrl(url) }); }))];
                        case 1:
                            store = (_a.sent()).filter(function (o) { return o.canDownload; }).map(function (o) { return o.store; })[0];
                            if (!store) return [3 /*break*/, 5];
                            return [4 /*yield*/, store.downloadUrl(url)
                                    .then(function (file) { return parseJsonAs({ path: [], fileName: url, contents: file }, "MASTER-INDEX" /* MasterIndex */); })];
                        case 2:
                            masterIndex = _a.sent();
                            masterIndex.url = url;
                            client_1 = masterIndex.clients[masterIndex.latestUpdate.clientID];
                            if (!client_1) {
                                return [2 /*return*/, Promise.reject(new Error("unable to parse master index at " + url + ", latest updated client not found"))];
                            }
                            return [4 /*yield*/, store.downloadUrl(client_1.url)
                                    .then(function (file) { return parseJsonAs({ path: [], fileName: client_1.url, contents: file }, "CLIENT-INDEX" /* ClientIndex */); })];
                        case 3:
                            clientIndex = _a.sent();
                            return [4 /*yield*/, Promise.all(
                                // fetch in parallel
                                clientIndex.parts.map(function (part) { return store.downloadUrl(part.url); }))];
                        case 4:
                            files = _a.sent();
                            // for this client, we must merge these change parts
                            // and restore a document from those parts
                            return [2 /*return*/, documentFromClientData({
                                    clientIndex: clientIndex,
                                    parts: files
                                }, null, masterIndex)];
                        case 5: return [2 /*return*/, Promise.reject(new Error("unable to download " + url + " as a document"))];
                    }
                });
            });
        };
        /**
         * Merge changes from this user's other clients in a remote store
         * @param document The documet to merge changes into (this is modified by this operation!)
         * @param ProgressFunction A function called to indicate progress of this operation (optional).
         * @return The document after the changes are applied to it
         */
        RemoteSync.prototype.mergeFromRemoteClients = function (document, onProgress) {
            if (onProgress === void 0) { onProgress = defaultProgress; }
            return __awaiter(this, void 0, void 0, function () {
                var logProgress, masterIndex, clientStates, clients, completed, total, clientIndexes;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug("mergeFromRemoteClients - merging into document " + document.getID() + "...");
                            logProgress = function (p) {
                                _this.logger.debug("mergeFromRemoteClients - " + Math.round(p * 100) + "%");
                                onProgress(p);
                            };
                            return [4 /*yield*/, this.getMasterIndex(document.getID())];
                        case 1:
                            masterIndex = _a.sent();
                            clientStates = document.getClientStates();
                            clients = Object.entries(masterIndex.clients).filter(function (_a) {
                                var clientID = _a[0], client = _a[1];
                                var previous = clientStates.find(function (s) { return s.clientID === clientID; });
                                return !previous || (previous.lastReceived < client.lastReceived);
                            }).map(function (v) { return v[0]; });
                            completed = 1;
                            total = 1 + clients.length;
                            logProgress(0.5 * (completed / total));
                            return [4 /*yield*/, Promise.all(clients.map(function (clientID) { return _this.getClientIndex(document.getID(), clientID)
                                    .then(function (res) {
                                    logProgress(0.5 * (++completed / total));
                                    return res;
                                }); }))];
                        case 2:
                            clientIndexes = _a.sent();
                            logProgress(0.5);
                            return [2 /*return*/, this.mergeClients(document, clientIndexes, undefined, 
                                // second part = remaining 50% of work
                                function (completion) { return logProgress(0.5 + 0.5 * completion); })];
                    }
                });
            });
        };
        /**
         * Merge changes from other users
         * @param document The document to merge changes into (this is modified by this operation!)
         * @param onProgress A function called to indicate progress of this operation (optional).
         * @return The document after the changes are applied to it
         */
        RemoteSync.prototype.mergeFromRemotePeers = function (document, onProgress) {
            if (onProgress === void 0) { onProgress = defaultProgress; }
            return __awaiter(this, void 0, void 0, function () {
                var logProgress, myMasterIndex, completed, total, peers, clientIndexes;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug("mergeFromRemotePeers - merging into document " + document.getID() + "...");
                            logProgress = function (p) {
                                _this.logger.debug("mergeFromRemotePeers - " + Math.round(p * 100) + "%");
                                onProgress(p);
                            };
                            return [4 /*yield*/, this.getMasterIndex(document.getID())];
                        case 1:
                            myMasterIndex = _a.sent();
                            completed = 1;
                            total = (1 + myMasterIndex.peers.length);
                            logProgress(0.25 * (completed / total)); // first part = 25% of work
                            return [4 /*yield*/, Promise.all(myMasterIndex.peers.map(function (peer) {
                                    return _this.getRemoteFile(peer.url, _this.allStores)
                                        .then(function (file) { return parseJsonAs(file, "MASTER-INDEX" /* MasterIndex */); })
                                        .then(function (theirMasterIndex) {
                                        // have we already seen this version, then ignore it, otherwise sync with it
                                        return document.isNewerThan(theirMasterIndex.latestUpdate) ? null : theirMasterIndex;
                                    })
                                        .then(function (res) {
                                        logProgress(0.25 * (++completed / total));
                                        return res;
                                    })
                                        .catch(_this.errorAsNull);
                                } // ignore any master index we couldn't fetch
                                ))];
                        case 2:
                            peers = (_a.sent()).filter(function (s) { return !!s; });
                            completed = 0;
                            total = peers.length + 1; // include merge operation
                            logProgress(0.25 + 0.25 * (completed / total)); // second part = 25% of work
                            return [4 /*yield*/, Promise.all(peers.map(function (peer) {
                                    var client = peer.clients[peer.latestUpdate.clientID];
                                    return _this.getRemoteFile(client.url, _this.allStores)
                                        .then(function (file) {
                                        logProgress(0.25 + 0.25 * (completed / total));
                                        return parseJsonAs(file, "CLIENT-INDEX" /* ClientIndex */);
                                    })
                                        .catch(_this.errorAsNull); // ignore any client index we couldn't fetch
                                }))];
                        case 3:
                            clientIndexes = (_a.sent()).filter(function (s) { return !!s; });
                            logProgress(0.5);
                            return [2 /*return*/, this.mergeClients(document, clientIndexes, this.allStores, 
                                // last part = remaining 50% of work
                                function (completion) { logProgress(0.5 + 0.5 * completion); })];
                    }
                });
            });
        };
        RemoteSync.prototype.getMasterIndex = function (documentID) {
            return this.store.getFile({
                path: pathFor(documentID),
                fileName: "master-index.json"
            }).then(function (file) {
                return parseJsonAs(file, "MASTER-INDEX" /* MasterIndex */);
            });
        };
        /**
         * Merge a series of remote clients into a document
         * @param document The document to merge the client data into
         * @param clientIndexes The data for the clients to merge
         * @param stores The stores to try to fetch client data through
         * @param onProgress A function called to indicate progress of this operation (optional).
         * @return The document with the merged changes
         */
        RemoteSync.prototype.mergeClients = function (document, clientIndexes, stores, onProgress) {
            if (stores === void 0) { stores = [this.store]; }
            if (onProgress === void 0) { onProgress = defaultProgress; }
            return __awaiter(this, void 0, void 0, function () {
                var clientStates, completedClients, total, changes, _i, changes_1, change, _a, _b, part;
                var _this = this;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            this.logger.debug("mergeClients - merging into document " + document.getID() + "...");
                            clientStates = document.getClientStates();
                            completedClients = 0;
                            total = clientIndexes.length + 1;
                            return [4 /*yield*/, Promise.all(clientIndexes.map(function (clientIndex) { return __awaiter(_this, void 0, void 0, function () {
                                    var previous_1, parts_1, completedParts_1, files, e_1;
                                    var _this = this;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                _a.trys.push([0, 2, , 3]);
                                                previous_1 = clientStates.find(function (s) { return s.clientID === clientIndex.clientID; });
                                                parts_1 = clientIndex.parts.filter(function (part) { return (!previous_1) || (previous_1.lastReceived < part.toVersion); });
                                                completedParts_1 = 0;
                                                return [4 /*yield*/, Promise.all(
                                                    // fetch in parallel
                                                    parts_1.map(function (part) { return _this.getRemoteFile(part.url, stores).then(JSON.parse)
                                                        .then(function (res) {
                                                        onProgress((completedClients + (++completedParts_1 / parts_1.length)) / total);
                                                        return res;
                                                    }); }))];
                                            case 1:
                                                files = _a.sent();
                                                onProgress(++completedClients / total);
                                                // for this client, we must merge these change parts
                                                return [2 /*return*/, {
                                                        clientIndex: clientIndex,
                                                        parts: files
                                                    }];
                                            case 2:
                                                e_1 = _a.sent();
                                                return [2 /*return*/, this.errorAsNull(e_1)]; // for any error, skip this client
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); }))];
                        case 1:
                            changes = _c.sent();
                            // merge all the parts into the document, sequentially by client, and then by part
                            for (_i = 0, changes_1 = changes; _i < changes_1.length; _i++) {
                                change = changes_1[_i];
                                this.logger.debug("mergeClients - merging from client " + change.clientIndex.clientID + " into document " + document.getID());
                                for (_a = 0, _b = change.parts; _a < _b.length; _a++) {
                                    part = _b[_a];
                                    document.mergeChanges(part);
                                }
                            }
                            this.logger.debug("mergeClients - done merging into document " + document.getID());
                            return [2 /*return*/, document];
                    }
                });
            });
        };
        RemoteSync.prototype.getClientIndex = function (documentID, clientID) {
            return this.store.getFile({
                path: pathFor(documentID, clientID),
                fileName: "client-index.json"
            }).then(function (file) {
                return parseJsonAs(file, "CLIENT-INDEX" /* ClientIndex */);
            });
        };
        RemoteSync.prototype.getRemoteFile = function (url, stores) {
            for (var _i = 0, stores_1 = stores; _i < stores_1.length; _i++) {
                var store = stores_1[_i];
                if (store.canDownloadUrl(url)) {
                    return store.downloadUrl(url);
                }
            }
            return Promise.reject(new Error("no compatible store"));
        };
        RemoteSync.prototype.updateMasterIndex = function (document, clientIndex, clientIndexUrl, store) {
            var _this = this;
            return this.getMasterIndex(document.getID())
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
                    updated: clientIndex.updated,
                    version: clientIndex.latest
                };
                masterIndex.peers = document.getPeers();
                return store.putFile({
                    path: pathFor(document.getID()),
                    fileName: "master-index.json",
                    contents: JSON.stringify(masterIndex)
                }).then(function (savedFile) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(masterIndex.url !== savedFile.url)) return [3 /*break*/, 2];
                                masterIndex.url = savedFile.url;
                                return [4 /*yield*/, store.putFile({
                                        path: pathFor(document.getID()),
                                        fileName: "master-index.json",
                                        contents: JSON.stringify(masterIndex)
                                    })];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2: return [2 /*return*/, masterIndex];
                        }
                    });
                }); });
            });
        };
        RemoteSync.prototype.errorAsNull = function (e) {
            this.logger.error(e);
            return null;
        };
        return RemoteSync;
    }());
    exports.RemoteSync = RemoteSync;
    function defaultProgress(completion) { }
    function fileKnownAs(json, dataType) {
        return (json && json._minisync && (json._minisync.dataType === dataType));
    }
    function parseJsonAs(file, dataType) {
        if (file === null)
            return null;
        var result = JSON.parse(typeof file === "string" ? file : file.contents);
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
            ((typeof handle === "string") ? handle :
                [].concat(handle.path, [handle.fileName]).filter(function (s) { return s; }).join("/")) +
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
            latestUpdate: null,
            url: null
        };
    }
    function documentFromClientData(changes, forClientID, fromPeer) {
        var parts = changes.parts.slice();
        if (parts.length) {
            var document_2 = new document_1.Document(JSON.parse(parts.shift()), changes.clientIndex.clientID === forClientID);
            for (var _i = 0, parts_2 = parts; _i < parts_2.length; _i++) {
                var part = parts_2[_i];
                document_2.mergeChanges(JSON.parse(part));
            }
            if (fromPeer)
                document_2.addPeer(fromPeer);
            return document_2;
        }
        throw new Error("unable to restore documents, no changes data to restore from");
    }
});
//# sourceMappingURL=remote.js.map