import * as base64 from "./base64";
import * as uid from "./uid";
import {Syncable} from "./syncable";
import {isArray, ClientState, ClientID, Version, State, AnyWithState} from "./types";

/**
 * Represents a single syncable document (top-level JSON object or array)
 * Keeps track of client state for this document across all the clients.
 * The Document is composed out of Syncable instances (wrappers around objects or arrays),
 * and primitive values. It can be nested arbitrarily deep, but all Syncables link back to the master Document.
 */
export default class Document extends Syncable {

    /**
     * Document class constructor
     * @param data Initial data for this instance, or a changes object (generated by getChanges)
     * @param restore If true, create this document as the client that generated the changes object
     * @constructor Document
     */
    constructor(data: ChangesObject | any, restore?: boolean) {
        if (typeof data != "object") throw "Argument must be an object";
        if (isArray(data)) throw "Argument cannot be an array";
        let isChanges: boolean =
            data && data._minisync && (data._minisync.dataType == "CHANGES");
        if (isChanges && data.changesSince) throw "change block must be non-delta";
        let shouldMerge: boolean = isChanges && !restore;
        let shouldRestore: boolean = isChanges && restore;
        super();
        this.setDocument(this);
        if (shouldMerge) {
            this.setData({});
            // ensure an initial state exists
            this.getDocVersion();
            this.mergeChanges(data);
            // for all client states, mark last confirmed send as current version
            let clientStates: Array<ClientState> = this.getClientStates();
            for (let i: number = 0; i < clientStates.length; i++) {
                let clientState = clientStates[i];
                clientState.lastAcknowledged = this.getDocVersion();
            }
        } else if (shouldRestore) {
            this.setData(data.changes, true);
            this.setClientID(data.sentBy);
            this.setDocVersion(data.fromVersion);
            this.setClientStates(data.clientStates);
        } else { // first init from raw data
            this.setData(data);
            // ensure an initial state exists
            this.getDocVersion();
        }
    }

    /**
     * Return the unique client ID of the document on this machine
     * @return {string}
     */
    public getClientID(): ClientID {
        let state: State = this.getState();
        if (!state.clientID) state.clientID = uid.nextLong();
        return state.clientID;
    }

    /**
     * Change the unique client ID of the document on this machine
     * @param {string} id
     */
    private setClientID(id: Version): void {
        this.getState().clientID = id;
    }

    /**
     * Return the master version for this document
     * @returns {string}
     */
    public getDocVersion(): Version {
        let version: Version = this.getState().v;
        if (!version) version = this.nextDocVersion();
        return version;
    }

    /**
     * Set the version of this document to a different one
     * @param {string} v
     */
    private setDocVersion(v: Version): void {
        this.getState().v = v;
    }

    /**
     * Increment the document version and return it
     * @returns {string}
     */
    public nextDocVersion(): Version {
        return this.getState().v =
            base64.nextVersion(this.getState().v, 6);
    }

    /**
     * Get the state object for a remote client
     * @param {String} clientID
     * @return {*} state object = {clientID, lastAcknowledged, lastReceived}
     */
    public getClientState(clientID: ClientID): ClientState {
        let states: Array<ClientState> = this.getClientStates();
        let clientData: ClientState;
        for (let i: number = 0; i < states.length; i++) {
            if (states[i].clientID === clientID) {
                clientData = states[i];
                break;
            }
        }
        if (!clientData) states.push(clientData = {
            clientID: clientID,
            // local version last confirmed as received remotely
            // we should send only newer versions than this
            lastAcknowledged: null,
            // remote version that was last received
            // we can ignore older remote versions than this
            lastReceived: null
        });
        return clientData;
    }

    /**
     * Return an array of the remote state objects for all known clients
     * @returns {Array}
     */
    public getClientStates(): Array<ClientState> {
        let state: State = this.getState();
        if (!state.remote) state.remote = [];
        return state.remote;
    }

    /**
     * Set a new array of remote client states
     * @param states
     */
    private setClientStates(states: Array<ClientState>): void {
        let state: State = this.getState();
        state.remote = states || [];
    }

    /**
     * Get updates to send to a remote client
     * @param {String} [clientID] Unique ID string for the remote client to get a delta update.
     * Leave empty to generate a universal state object containing the whole document
     * that can be synchronized against any remote client (even if never synced before)
     * @returns {*} data object to send
     */
    public getChanges(clientID: ClientID): ChangesObject {
        let changesSince: string = null;
        if (clientID) {
            let clientState: ClientState = this.getClientState(clientID);
            changesSince = clientState.lastAcknowledged;
        }
        let changes: AnyWithState = this.getChangesSince(changesSince);
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
    }

    /**
     * Merge updates from a remote client, updating the data and P2P client state
     * @param data Change data
     * @returns {*} data object to send
     */
    public mergeChanges(data: ChangesObject | any): void {
        if (<ChangesObject> data) {
            // state of remote client as stored in this copy of the document
            let clientState: ClientState = this.getClientState(data.sentBy);
            // state of this client as stored in the remote copy of the document
            let remoteState: ClientState = null;
            for (let i: number = 0; i < data.clientStates.length; i++) {
                if (data.clientStates[i].clientID == this.getClientID()) {
                    remoteState = data.clientStates[i];
                    break;
                }
            }
            if (remoteState && (clientState.lastAcknowledged < remoteState.lastReceived)) {
                clientState.lastAcknowledged = remoteState.lastReceived;
            }
            let allWasSent: boolean = clientState.lastAcknowledged === this.getDocVersion();
            // inherited, actual merging of changes
            super.mergeChanges(data.changes, clientState);
            clientState.lastReceived = data.fromVersion;

            for (let j: number = 0; j < data.clientStates.length; j++) {
                remoteState = data.clientStates[j];
                if (remoteState.clientID != this.getClientID()) {
                    let localState: ClientState = this.getClientState(remoteState.clientID);
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
        } else {
            throw "Invalid changes object";
        }
    }

}

/**
 * JSON object that carries document changes between clients
 */
interface ChangesObject {
    /** Allows identifying this as a ChangesObject when untyped */
    _minisync: ChangesObjectVersion;
    /** Which client sent these changes */
    sentBy: ClientID;
    /** The client's version the changes were taken from */
    fromVersion: Version;
    /** The state of all peers as known to that client */
    clientStates: Array<ClientState>;
    /** The version starting from which changes are reported */
    changesSince: Version;
    /** The changes themselves */
    changes: AnyWithState;
}

interface ChangesObjectVersion {
    /** CHANGES for a changes object */
    dataType: string;
    /** CHANGES format version, for future compatibility */
    version: number;
}
