import * as chai from "chai";
import * as sinon from "sinon";
import * as minisync from "../minisync";
import { MemoryStore } from "./memorystore";
import { createFromRemote, createFromUrl, getClientIndex, getMasterIndex,
    mergeFromRemoteClients, publishRemote, saveRemote } from "./remote";

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
            expect(masterIndex.latestUpdate).to.be.an("object");
            const clientID = masterIndex.latestUpdate.clientID;
            expect(clientID).to.equal(document.getClientID());
            const clientEntry = masterIndex.clients[clientID];
            expect(clientEntry).to.be.an("object");
            expect(clientEntry.label).to.equal("Bob");
            expect(clientEntry.lastReceived).to.be.a("string");
            expect(clientEntry.url).to.match(/^data:/);

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
                fileName: "part-00000000.json"
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
            expect(clientIndex.parts[0].url).to.match(/^data:/);

            const partFile = await store.getFile({
                path: ["documents", "document-" + document.getID(), "client-" + document.getClientID()],
                fileName: "part-00000000.json"
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
                fileName: "part-00000001.json"
            });
            expect(partFile.contents).to.be.a("string");
            const partData = JSON.parse(partFile.contents);
            expect(partData).to.be.an("object");
            expect(partData.changes).to.be.an("object");
            expect(partData.changes.foo).to.be.an("object");
            expect(partData.changes.foo.v).to.be.an("array");
            expect(partData.changes.foo.v).to.eql(["A", "B"]);
        });

        it("merges from remote clients", async () => {
            store = new MemoryStore();
            const client1 = minisync.from({foo: ["A"]});
            await saveRemote(client1, store);

            // should be identical
            const client2 = minisync.from(client1.getChanges());
            expect(client2.get("foo").getData()).to.eql(["A"]);

            client1.set("foo[1]", "B");
            // vreates another parts file, containing only B
            await saveRemote(client1, store, { partSizeLimit: 1 });
            // will merge the second part from client1
            await mergeFromRemoteClients(client2, store);
            expect(client2.get("foo").getData()).to.eql(["A", "B"]);

            // now reverse direction and add C from client2 into client1
            client2.set("foo[2]", "C"),
            await saveRemote(client2, store);
            await mergeFromRemoteClients(client1, store);
            expect(client1.get("foo").getData()).to.eql(["A", "B", "C"]);
        });

        it("minimizes remote calls when merging from remote clients", async () => {
            store = new MemoryStore();

            const client1 = minisync.from({foo: ["A"]});
            await saveRemote(client1, store);
            const client2 = minisync.from(client1.getChanges());
            await saveRemote(client2, store);
            client1.set("foo[1]", "B");
            await saveRemote(client1, store);

            // merge all changes
            await mergeFromRemoteClients(client2, store);
            try {
                sinon.spy(store, "getFile");
                // nothing to merge, so we should see only 3 fetches of master-index.json
                await mergeFromRemoteClients(client2, store);
                await mergeFromRemoteClients(client2, store);
                await mergeFromRemoteClients(client2, store);
                expect((store.getFile as any).callCount).to.equal(3);
                const args = (store.getFile as any).getCall(2).args;
                expect(args.length).to.equal(1);
                expect(args[0].fileName).to.equal("master-index.json");
            } finally {
                (store.getFile as any).restore();
            }
        });

        it("restores from a documentID and a store", async () => {
            store = new MemoryStore();

            const client1 = minisync.from({foo: ["A"]});
            await saveRemote(client1, store);
            client1.set("foo[1]", "B");
            // vreates another parts file, containing only B
            await saveRemote(client1, store, { partSizeLimit: 1 });

            const client2 = await createFromRemote(client1.getID(), store);
            expect(client2.getData()).to.eql(client1.getData());
        });

        it("restores from a url", async () => {
            store = new MemoryStore();

            const client1 = minisync.from({foo: ["A"]});
            await saveRemote(client1, store);
            client1.set("foo[1]", "B");
            // vreates another parts file, containing only B
            const clientIndex = await saveRemote(client1, store, { partSizeLimit: 1 });
            // publish the master index
            const url = await publishRemote(client1.getID(), store);
            // construct a new client from the published url
            const client2 = await createFromUrl(url, [store]);
            expect(client2.getData()).to.eql(client1.getData());
        });
    });
});
