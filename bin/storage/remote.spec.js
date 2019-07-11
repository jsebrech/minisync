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
        define(["require", "exports", "chai", "../minisync", "./memorystore", "./remote"], factory);
    }
})(function (require, exports) {
    "use strict";
    var _this = this;
    Object.defineProperty(exports, "__esModule", { value: true });
    var chai = require("chai");
    var minisync = require("../minisync");
    var memorystore_1 = require("./memorystore");
    var remote_1 = require("./remote");
    var expect = chai.expect;
    describe("minisync storage", function () {
        describe("remote sync", function () {
            var store;
            beforeEach(function () {
                store = new memorystore_1.MemoryStore({
                    documents: {
                        "document-ABC": {
                            "master-index.json": JSON.stringify({
                                _minisync: {
                                    dataType: "MASTER-INDEX"
                                }
                            }),
                            "client-FOO": {
                                "client-index.json": JSON.stringify({
                                    _minisync: {
                                        dataType: "CLIENT-INDEX"
                                    }
                                })
                            }
                        }
                    }
                });
            });
            it("getClientIndex returns the right file", function (done) {
                remote_1.getClientIndex("ABC", "FOO", store).then(function (index) {
                    expect(index).to.be.an("object");
                    done();
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("getMasterIndex returns the right file", function (done) {
                remote_1.getMasterIndex("ABC", store).then(function (index) {
                    expect(index).to.be.an("object");
                    done();
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("saves to a blank remote store", function () { return __awaiter(_this, void 0, void 0, function () {
                var document, masterIndex, clientID, clientEntry, clientIndex, part, partFile, partData;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            store = new memorystore_1.MemoryStore();
                            document = minisync.from({ foo: ["A"] });
                            return [4 /*yield*/, remote_1.saveRemote(document, store, { clientName: "Bob" })];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, remote_1.getMasterIndex(document.getID(), store)];
                        case 2:
                            masterIndex = _a.sent();
                            expect(masterIndex.clients).to.be.an("object");
                            clientID = masterIndex.latestUpdate;
                            expect(clientID).to.equal(document.getClientID());
                            clientEntry = masterIndex.clients[clientID];
                            expect(clientEntry).to.be.an("object");
                            expect(clientEntry.label).to.equal("Bob");
                            expect(clientEntry.version).to.be.a("string");
                            return [4 /*yield*/, remote_1.getClientIndex(document.getID(), document.getClientID(), store)];
                        case 3:
                            clientIndex = _a.sent();
                            expect(clientIndex).to.be.an("object");
                            expect(clientIndex.clientID).to.equal(clientID);
                            expect(clientIndex.clientName).to.equal("Bob");
                            expect(clientIndex.latest).to.equal(document.getDocVersion());
                            expect(clientIndex.parts).to.be.an("array");
                            expect(clientIndex.parts.length).to.equal(1);
                            part = clientIndex.parts[0];
                            expect(part.id).to.equal(0);
                            expect(part.fromVersion).to.be.a("null");
                            expect(part.toVersion).to.equal(clientIndex.latest);
                            expect(part.size).to.be.above(0);
                            return [4 /*yield*/, store.getFile({
                                    path: ["documents", "document-" + document.getID(), "client-" + document.getClientID()],
                                    fileName: "part-00000000"
                                })];
                        case 4:
                            partFile = _a.sent();
                            expect(partFile.contents).to.be.a("string");
                            partData = JSON.parse(partFile.contents);
                            expect(partData).to.be.an("object");
                            expect(partData.changes).to.be.an("object");
                            expect(partData.changes.foo).to.be.an("object");
                            expect(partData.changes.foo.v).to.be.an("array");
                            expect(partData.changes.foo.v[0]).to.equal("A");
                            return [2 /*return*/];
                    }
                });
            }); });
            it("appends to an existing part if part is small", function () { return __awaiter(_this, void 0, void 0, function () {
                var document, clientIndex, partFile, partData;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            store = new memorystore_1.MemoryStore();
                            document = minisync.from({ foo: ["A"] });
                            return [4 /*yield*/, remote_1.saveRemote(document, store)];
                        case 1:
                            _a.sent();
                            document.set("foo[1]", "B");
                            return [4 /*yield*/, remote_1.saveRemote(document, store)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, remote_1.getClientIndex(document.getID(), document.getClientID(), store)];
                        case 3:
                            clientIndex = _a.sent();
                            expect(clientIndex).to.be.an("object");
                            expect(clientIndex.parts).to.be.an("array");
                            expect(clientIndex.parts.length).to.equal(1);
                            expect(clientIndex.parts[0].id).to.equal(0);
                            expect(clientIndex.parts[0].toVersion).to.equal(document.getDocVersion());
                            return [4 /*yield*/, store.getFile({
                                    path: ["documents", "document-" + document.getID(), "client-" + document.getClientID()],
                                    fileName: "part-00000000"
                                })];
                        case 4:
                            partFile = _a.sent();
                            expect(partFile.contents).to.be.a("string");
                            partData = JSON.parse(partFile.contents);
                            expect(partData).to.be.an("object");
                            expect(partData.changes).to.be.an("object");
                            expect(partData.changes.foo).to.be.an("object");
                            expect(partData.changes.foo.v).to.be.an("array");
                            expect(partData.changes.foo.v).to.eql(["A", "B"]);
                            return [2 /*return*/];
                    }
                });
            }); });
            it("starts a new part if the previous part was above the size limit", function () { return __awaiter(_this, void 0, void 0, function () {
                var document, firstVersion, secondVersion, clientIndex, partFile, partData;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            store = new memorystore_1.MemoryStore();
                            document = minisync.from({ foo: ["A"] });
                            firstVersion = document.getDocVersion();
                            return [4 /*yield*/, remote_1.saveRemote(document, store)];
                        case 1:
                            _a.sent();
                            document.set("foo[1]", "B");
                            secondVersion = document.getDocVersion();
                            return [4 /*yield*/, remote_1.saveRemote(document, store, { partSizeLimit: 1 })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, remote_1.getClientIndex(document.getID(), document.getClientID(), store)];
                        case 3:
                            clientIndex = _a.sent();
                            expect(clientIndex).to.be.an("object");
                            expect(clientIndex.parts).to.be.an("array");
                            expect(clientIndex.parts.length).to.equal(2);
                            expect(clientIndex.parts[0].id).to.equal(0);
                            expect(clientIndex.parts[0].fromVersion).to.be.a("null");
                            expect(clientIndex.parts[0].toVersion).to.equal(firstVersion);
                            expect(clientIndex.parts[0].id).to.equal(0);
                            expect(clientIndex.parts[1].fromVersion).to.equal(firstVersion);
                            expect(clientIndex.parts[1].toVersion).to.equal(secondVersion);
                            return [4 /*yield*/, store.getFile({
                                    path: ["documents", "document-" + document.getID(), "client-" + document.getClientID()],
                                    fileName: "part-00000001"
                                })];
                        case 4:
                            partFile = _a.sent();
                            expect(partFile.contents).to.be.a("string");
                            partData = JSON.parse(partFile.contents);
                            expect(partData).to.be.an("object");
                            expect(partData.changes).to.be.an("object");
                            expect(partData.changes.foo).to.be.an("object");
                            expect(partData.changes.foo.v).to.be.an("array");
                            expect(partData.changes.foo.v).to.eql(["A", "B"]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=remote.spec.js.map