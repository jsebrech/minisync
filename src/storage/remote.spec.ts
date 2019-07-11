import * as chai from "chai";
import * as minisync from "../minisync";
import { MemoryStore } from "./memorystore";
import { getClientIndex, getMasterIndex, saveRemote } from "./remote";

const expect = chai.expect;

describe("minisync storage", () => {
    describe("remote sync", () => {

        let store: MemoryStore;

        beforeEach(() => {
            store = new MemoryStore({
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

        it("getClientIndex returns the right file", (done) => {
            getClientIndex("ABC", "FOO", store).then((index) => {
                expect(index).to.be.an("object");
                done();
            }).catch((e) => done(new Error(e)));
        });

        it("getMasterIndex returns the right file", (done) => {
            getMasterIndex("ABC", store).then((index) => {
                expect(index).to.be.an("object");
                done();
            }).catch((e) => done(new Error(e)));
        });

        it("saves to a blank remote store", async () => {
            store = new MemoryStore();
            const document = minisync.from({foo: ["A"]});
            await saveRemote(document, store, { clientName: "Bob" });
            const masterIndex = await getMasterIndex(document.getID(), store);
            expect(masterIndex.clients).to.be.an("object");
            const clientID = masterIndex.latestUpdate;
            expect(clientID).to.equal(document.getClientID());
            const clientEntry = masterIndex.clients[clientID];
            expect(clientEntry).to.be.an("object");
            expect(clientEntry.label).to.equal("Bob");
            expect(clientEntry.version).to.be.a("string");

            const clientIndex = await getClientIndex(document.getID(), document.getClientID(), store);
            expect(clientIndex).to.be.an("object");
            expect(clientIndex.clientID).to.equal(clientID);
            expect(clientIndex.clientName).to.equal("Bob");
            expect(clientIndex.latest).to.equal(document.getDocVersion());
            expect(clientIndex.parts).to.be.an("array");
            expect(clientIndex.parts.length).to.equal(1);
            const part = clientIndex.parts[0];
            expect(part.id).to.equal(0);
            expect(part.fromVersion).to.be.a("null");
            expect(part.toVersion).to.equal(clientIndex.latest);
            expect(part.size).to.be.above(0);

            const partFile = await store.getFile({
                path: ["documents", "document-" + document.getID(), "client-" + document.getClientID()],
                fileName: "part-00000000"
            });
            expect(partFile.contents).to.be.a("string");
            const partData = JSON.parse(partFile.contents);
            expect(partData).to.be.an("object");
            expect(partData.changes).to.be.an("object");
            expect(partData.changes.foo).to.be.an("object");
            expect(partData.changes.foo.v).to.be.an("array");
            expect(partData.changes.foo.v[0]).to.equal("A");
        });

        it("appends to an existing part if part is small", async () => {
            store = new MemoryStore();
            const document = minisync.from({foo: ["A"]});
            await saveRemote(document, store);
            document.set("foo[1]", "B");
            await saveRemote(document, store);

            const clientIndex = await getClientIndex(document.getID(), document.getClientID(), store);
            expect(clientIndex).to.be.an("object");
            expect(clientIndex.parts).to.be.an("array");
            expect(clientIndex.parts.length).to.equal(1);
            expect(clientIndex.parts[0].id).to.equal(0);
            expect(clientIndex.parts[0].toVersion).to.equal(document.getDocVersion());

            const partFile = await store.getFile({
                path: ["documents", "document-" + document.getID(), "client-" + document.getClientID()],
                fileName: "part-00000000"
            });
            expect(partFile.contents).to.be.a("string");
            const partData = JSON.parse(partFile.contents);
            expect(partData).to.be.an("object");
            expect(partData.changes).to.be.an("object");
            expect(partData.changes.foo).to.be.an("object");
            expect(partData.changes.foo.v).to.be.an("array");
            expect(partData.changes.foo.v).to.eql(["A", "B"]);
        });

        it("starts a new part if the previous part was above the size limit", async () => {
            store = new MemoryStore();
            const document = minisync.from({foo: ["A"]});
            const firstVersion = document.getDocVersion();
            await saveRemote(document, store);
            document.set("foo[1]", "B");
            const secondVersion = document.getDocVersion();
            await saveRemote(document, store, { partSizeLimit: 1 });

            const clientIndex = await getClientIndex(document.getID(), document.getClientID(), store);
            expect(clientIndex).to.be.an("object");
            expect(clientIndex.parts).to.be.an("array");
            expect(clientIndex.parts.length).to.equal(2);
            expect(clientIndex.parts[0].id).to.equal(0);
            expect(clientIndex.parts[0].fromVersion).to.be.a("null");
            expect(clientIndex.parts[0].toVersion).to.equal(firstVersion);
            expect(clientIndex.parts[0].id).to.equal(0);
            expect(clientIndex.parts[1].fromVersion).to.equal(firstVersion);
            expect(clientIndex.parts[1].toVersion).to.equal(secondVersion);

            const partFile = await store.getFile({
                path: ["documents", "document-" + document.getID(), "client-" + document.getClientID()],
                fileName: "part-00000001"
            });
            expect(partFile.contents).to.be.a("string");
            const partData = JSON.parse(partFile.contents);
            expect(partData).to.be.an("object");
            expect(partData.changes).to.be.an("object");
            expect(partData.changes.foo).to.be.an("object");
            expect(partData.changes.foo.v).to.be.an("array");
            expect(partData.changes.foo.v).to.eql(["A", "B"]);
        });
    });
});
