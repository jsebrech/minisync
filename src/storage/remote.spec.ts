import * as chai from "chai";
import * as sinon from "sinon";
import * as minisync from "../minisync";
import { RemoteSync } from "./remote";
import { MemoryStore } from "./stores/memorystore";
import { FileData, RemoteFileHandle } from "./types";

const expect = chai.expect;

describe("minisync storage", () => {
    describe("remote sync", () => {

        let store: MemoryStore;
        let sync: RemoteSync;

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
            sync = new RemoteSync(store);
        });

        it("getClientIndex returns the right file", (done) => {
            sync.getClientIndex("ABC", "FOO").then((index) => {
                expect(index).to.be.an("object");
                done();
            }).catch((e) => done(new Error(e)));
        });

        it("getMasterIndex returns the right file", (done) => {
            sync.getMasterIndex("ABC").then((index) => {
                expect(index).to.be.an("object");
                done();
            }).catch((e) => done(new Error(e)));
        });

        it("saves to a blank remote store", async () => {
            store = new MemoryStore();
            sync = new RemoteSync(store);
            const document = minisync.from({foo: ["A"]});
            await sync.saveRemote(document, { clientName: "Bob" });
            const masterIndex = await sync.getMasterIndex(document.getID());
            expect(masterIndex.clients).to.be.an("object");
            expect(masterIndex.latestUpdate).to.be.an("object");
            const clientID = masterIndex.latestUpdate!.clientID;
            expect(clientID).to.be.a("string");
            expect(clientID).to.equal(document.getClientID());
            const clientEntry = masterIndex.clients[clientID];
            expect(clientEntry).to.be.an("object");
            expect(clientEntry.label).to.equal("Bob");
            expect(clientEntry.lastReceived).to.be.a("string");
            expect(clientEntry.url).to.match(/^data:/);

            const clientIndex = await sync.getClientIndex(document.getID(), document.getClientID());
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
            expect(partFile?.contents).to.be.a("string");
            const partData = partFile && JSON.parse(partFile.contents);
            expect(partData).to.be.an("object");
            expect(partData.changes).to.be.an("object");
            expect(partData.changes.foo).to.be.an("object");
            expect(partData.changes.foo.v).to.be.an("array");
            expect(partData.changes.foo.v[0]).to.equal("A");
        });

        it("appends to an existing part if part is small", async () => {
            store = new MemoryStore();
            sync = new RemoteSync(store);
            const document = minisync.from({foo: ["A"]});
            await sync.saveRemote(document);
            document.set("foo[1]", "B");
            await sync.saveRemote(document);

            const clientIndex = await sync.getClientIndex(document.getID(), document.getClientID());
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
            expect(partFile?.contents).to.be.a("string");
            const partData = partFile && JSON.parse(partFile.contents);
            expect(partData).to.be.an("object");
            expect(partData.changes).to.be.an("object");
            expect(partData.changes.foo).to.be.an("object");
            expect(partData.changes.foo.v).to.be.an("array");
            expect(partData.changes.foo.v).to.eql(["A", "B"]);
        });

        it("starts a new part if the previous part was above the size limit", async () => {
            store = new MemoryStore();
            sync = new RemoteSync(store);
            const document = minisync.from({foo: ["A"]});
            const firstVersion = document.getDocVersion();
            await sync.saveRemote(document);
            document.set("foo[1]", "B");
            const secondVersion = document.getDocVersion();
            await sync.saveRemote(document, { partSizeLimit: 1 });

            const clientIndex = await sync.getClientIndex(document.getID(), document.getClientID());
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
            expect(partFile?.contents).to.be.a("string");
            const partData = partFile && JSON.parse(partFile.contents);
            expect(partData).to.be.an("object");
            expect(partData.changes).to.be.an("object");
            expect(partData.changes.foo).to.be.an("object");
            expect(partData.changes.foo.v).to.be.an("array");
            expect(partData.changes.foo.v).to.eql(["A", "B"]);
        });

        it("merges from remote clients", async () => {
            store = new MemoryStore();
            const client1 = minisync.from({foo: ["A"]});
            await sync.saveRemote(client1);

            // should be identical
            const client2 = minisync.from(client1.getChanges());
            expect(client2.get("foo").getData()).to.eql(["A"]);

            client1.set("foo[1]", "B");
            // vreates another parts file, containing only B
            await sync.saveRemote(client1, { partSizeLimit: 1 });
            // will merge the second part from client1
            await sync.mergeFromRemoteClients(client2);
            expect(client2.get("foo").getData()).to.eql(["A", "B"]);

            // now reverse direction and add C from client2 into client1
            client2.set("foo[2]", "C"),
            await sync.saveRemote(client2);
            await sync.mergeFromRemoteClients(client1);
            expect(client1.get("foo").getData()).to.eql(["A", "B", "C"]);
        });

        it("minimizes remote calls when merging from remote clients", async () => {
            store = new MemoryStore();
            sync = new RemoteSync(store);

            const client1 = minisync.from({foo: ["A"]});
            await sync.saveRemote(client1);
            const client2 = minisync.from(client1.getChanges());
            await sync.saveRemote(client2);
            client1.set("foo[1]", "B");
            await sync.saveRemote(client1);

            // merge all changes
            await sync.mergeFromRemoteClients(client2);
            try {
                sinon.spy(store, "getFile");
                // nothing to merge, so we should see only 3 fetches of master-index.json
                await sync.mergeFromRemoteClients(client2);
                await sync.mergeFromRemoteClients(client2);
                await sync.mergeFromRemoteClients(client2);
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
            await sync.saveRemote(client1);
            client1.set("foo[1]", "B");
            // vreates another parts file, containing only B
            await sync.saveRemote(client1, { partSizeLimit: 1 });

            const client2 = await sync.createFromRemote(client1.getID());
            expect(client2.getData()).to.eql(client1.getData());
        });

        it("restores from a url", async () => {
            store = new MemoryStore();

            const client1 = minisync.from({foo: ["A"]});
            await sync.saveRemote(client1);
            client1.set("foo[1]", "B");
            // vreates another parts file, containing only B
            const clientIndex = await sync.saveRemote(client1, { partSizeLimit: 1 });
            expect(clientIndex).not.to.be.null;
            // construct a new client from the published url
            const client2 = await sync.createFromUrl(clientIndex!.masterIndexUrl!);
            expect(client2.getData()).to.eql(client1.getData());
        });

        it("merges from remote peers", async () => {
            const peer1 = new TestStore();
            const peer2 = new TestStore();
            const sync1 = new RemoteSync(peer1);
            const sync2 = new RemoteSync(peer2);

            const client1 = minisync.from({foo: ["A"]});
            const published = await sync1.saveRemote(client1);
            expect(published).not.to.be.null;

            // should be identical
            const client2 = await sync2.createFromUrl(published!.masterIndexUrl!);
            expect(client2.get("foo").getData()).to.eql(["A"]);
            const client2Index = await sync2.saveRemote(client2);
            const peer2Index = await sync2.getMasterIndex(client2.getID());
            expect(client2Index).not.to.be.null;

            // make client1 aware of the other peer
            client1.addPeer({
                url: client2Index!.masterIndexUrl,
                latestUpdate: peer2Index.latestUpdate,
                label: peer2Index.label
            });

            client1.set("foo[1]", "B");
            await sync1.saveRemote(client1);
            // will merge the updated part data from peer1
            await sync2.mergeFromRemotePeers(client2);
            expect(client2.get("foo").getData()).to.eql(["A", "B"]);

            // now reverse direction and add C from client2 into client1
            client2.set("foo[2]", "C"),
            await sync2.saveRemote(client2);
            await sync1.mergeFromRemotePeers(client1);
            expect(client1.get("foo").getData()).to.eql(["A", "B", "C"]);
        });

    });
});

/** A memory store which allows updating content behind static url's */
class TestStore extends MemoryStore {
    private static stores: TestStore[] = [];

    public id: number;

    constructor(readonly files: any = {}) {
        super(files);
        this.id = TestStore.stores.length;
        TestStore.stores[this.id] = this;
    }

    public putFile(file: FileData): Promise<RemoteFileHandle> {
        return super.putFile(file).then((handle) => {
            handle.url = "test://" + this.id + "/" +
                file.path.join("/") + "/" + file.fileName;
            return handle;
        });
    }

    public canDownloadUrl(url: string): Promise<boolean> {
        return Promise.resolve(/^test\:/.test(url));
    }

    public downloadUrl(url: string): Promise<string> {
        const path = url.slice("test://".length).split("/");
        const fileName: string = path.pop()!;
        const storeId = parseInt(path.shift()!, 10);
        const store = TestStore.stores[storeId];
        return store.getFile({ path, fileName }).then((file) => file ? file.contents : "");
    }
 }
