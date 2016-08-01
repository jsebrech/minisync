var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports", "./base64", "./uid", "./syncable", "./types"], factory);
    }
})(function (require, exports) {
    "use strict";
    var base64 = require("./base64");
    var uid = require("./uid");
    var syncable_1 = require("./syncable");
    var types_1 = require("./types");
    /**
     * Represents a single syncable document (top-level JSON object or array)
     * Keeps track of client state for this document across all the clients.
     * The Document is composed out of Syncable instances (wrappers around objects or arrays),
     * and primitive values. It can be nested arbitrarily deep, but all Syncables link back to the master Document.
     */
    var Document = (function (_super) {
        __extends(Document, _super);
        /**
         * Document class constructor
         * @param data Initial data for this instance, or a changes object (generated by getChanges)
         * @param restore If true, create this document as the client that generated the changes object
         * @constructor Document
         */
        function Document(data, restore) {
            if (typeof data != "object")
                throw "Argument must be an object";
            if (types_1.isArray(data))
                throw "Argument cannot be an array";
            var isChanges = data && data._minisync && (data._minisync.dataType == "CHANGES");
            if (isChanges && data.changesSince)
                throw "change block must be non-delta";
            var shouldMerge = isChanges && !restore;
            var shouldRestore = isChanges && restore;
            _super.call(this);
            this.setDocument(this);
            if (shouldMerge) {
                this.setData({});
                // ensure an initial state exists
                this.getDocVersion();
                this.mergeChanges(data);
                // for all client states, mark last confirmed send as current version
                var clientStates = this.getClientStates();
                for (var i = 0; i < clientStates.length; i++) {
                    var clientState = clientStates[i];
                    clientState.lastAcknowledged = this.getDocVersion();
                }
            }
            else if (shouldRestore) {
                this.setData(data.changes, true);
                this.setClientID(data.sentBy);
                this.setDocVersion(data.fromVersion);
                this.setClientStates(data.clientStates);
            }
            else {
                this.setData(data);
                // ensure an initial state exists
                this.getDocVersion();
            }
        }
        /**
         * Return the unique client ID of the document on this machine
         * @return {string}
         */
        Document.prototype.getClientID = function () {
            var state = this.getState();
            if (!state.clientID)
                state.clientID = uid.nextLong();
            return state.clientID;
        };
        /**
         * Change the unique client ID of the document on this machine
         * @param {string} id
         */
        Document.prototype.setClientID = function (id) {
            this.getState().clientID = id;
        };
        /**
         * Return the master version for this document
         * @returns {string}
         */
        Document.prototype.getDocVersion = function () {
            var version = this.getState().v;
            if (!version)
                version = this.nextDocVersion();
            return version;
        };
        /**
         * Set the version of this document to a different one
         * @param {string} v
         */
        Document.prototype.setDocVersion = function (v) {
            this.getState().v = v;
        };
        /**
         * Increment the document version and return it
         * @returns {string}
         */
        Document.prototype.nextDocVersion = function () {
            return this.getState().v =
                base64.nextVersion(this.getState().v, 6);
        };
        /**
         * Get the state object for a remote client
         * @param {String} clientID
         * @return {*} state object = {clientID, lastAcknowledged, lastReceived}
         */
        Document.prototype.getClientState = function (clientID) {
            var states = this.getClientStates();
            var clientData;
            for (var i = 0; i < states.length; i++) {
                if (states[i].clientID === clientID) {
                    clientData = states[i];
                    break;
                }
            }
            if (!clientData)
                states.push(clientData = {
                    clientID: clientID,
                    // local version last confirmed as received remotely
                    // we should send only newer versions than this
                    lastAcknowledged: null,
                    // remote version that was last received
                    // we can ignore older remote versions than this
                    lastReceived: null
                });
            return clientData;
        };
        /**
         * Return an array of the remote state objects for all known clients
         * @returns {Array}
         */
        Document.prototype.getClientStates = function () {
            var state = this.getState();
            if (!state.remote)
                state.remote = [];
            return state.remote;
        };
        /**
         * Set a new array of remote client states
         * @param states
         */
        Document.prototype.setClientStates = function (states) {
            var state = this.getState();
            state.remote = states || [];
        };
        /**
         * Get updates to send to a remote client
         * @param {String} [clientID] Unique ID string for the remote client to get a delta update.
         * Leave empty to generate a universal state object containing the whole document
         * that can be synchronized against any remote client (even if never synced before)
         * @returns {*} data object to send
         */
        Document.prototype.getChanges = function (clientID) {
            var changesSince = null;
            if (clientID) {
                var clientState = this.getClientState(clientID);
                changesSince = clientState.lastAcknowledged;
            }
            var changes = this.getChangesSince(changesSince);
            return {
                _minisync: {
                    dataType: "CHANGES",
                    version: 1
                },
                sentBy: this.getClientID(),
                fromVersion: this.getDocVersion(),
                clientStates: this.getClientStates(),
                changesSince: changesSince,
                changes: changes
            };
        };
        /**
         * Merge updates from a remote client, updating the data and P2P client state
         * @param data Change data
         * @returns {*} data object to send
         */
        Document.prototype.mergeChanges = function (data) {
            if (data) {
                // state of remote client as stored in this copy of the document
                var clientState = this.getClientState(data.sentBy);
                // state of this client as stored in the remote copy of the document
                var remoteState = null;
                for (var i = 0; i < data.clientStates.length; i++) {
                    if (data.clientStates[i].clientID == this.getClientID()) {
                        remoteState = data.clientStates[i];
                        break;
                    }
                }
                if (remoteState && (clientState.lastAcknowledged < remoteState.lastReceived)) {
                    clientState.lastAcknowledged = remoteState.lastReceived;
                }
                var allWasSent = clientState.lastAcknowledged === this.getDocVersion();
                // inherited, actual merging of changes
                _super.prototype.mergeChanges.call(this, data.changes, clientState);
                clientState.lastReceived = data.fromVersion;
                for (var j = 0; j < data.clientStates.length; j++) {
                    remoteState = data.clientStates[j];
                    if (remoteState.clientID != this.getClientID()) {
                        var localState = this.getClientState(remoteState.clientID);
                        // update remote version that was last received
                        if (localState.lastReceived < remoteState.lastReceived) {
                            localState.lastReceived = remoteState.lastReceived;
                        }
                        // if our state matches the state of the other client
                        // and their state matches the state of the third party
                        // the third party has received our version already
                        if (allWasSent && (data.fromVersion == remoteState.lastAcknowledged)) {
                            localState.lastAcknowledged = this.getDocVersion();
                        }
                    }
                }
                // syncing updates the local version
                // we shouldn't send updates for versions added by syncing
                if (allWasSent) {
                    clientState.lastAcknowledged = this.getDocVersion();
                }
            }
            else {
                throw "Invalid changes object";
            }
        };
        return Document;
    }(syncable_1.Syncable));
    exports.__esModule = true;
    exports["default"] = Document;
});
//# sourceMappingURL=document.js.map