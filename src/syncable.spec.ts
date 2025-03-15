import * as minisync from "./minisync";
import { compareObjects, getData } from "./test-utils";

import * as chai from "chai";
import * as sinon from "sinon";
import { SyncableArray } from "./syncable";

const expect = chai.expect;

describe("minisync p2p", () => {

    describe("client interaction", () => {

        it("should have a unique client id", () => {
            const c1 = minisync.from({foo: "bar"});
            const c2 = minisync.from({foo: "bar"});
            const id1 = c1.getClientID();
            expect(id1).not.to.be.a("null");
            expect(id1).to.be.a("string");
            expect(id1.length).to.equal(16);
            expect(id1).to.equal(c1.getClientID());
            expect(c1).not.to.equal(c2.getClientID());
        });

        it("should obtain changes", () => {
            const o = minisync.from({foo: "bar"});
            let changes = o.getChangesForClient("client1");
            expect(changes).not.to.be.a("null");
            expect(changes.sentBy).to.equal(o.getClientID());
            expect(changes.fromVersion).to.equal(o.getDocVersion());
            expect(changes.changes).not.to.be.a("null");
            expect(changes.changes!.foo).to.equal("bar");
            o.set("foo", "baz");
            changes = o.getChangesForClient("client1");
            expect(changes).not.to.be.a("null");
            expect(changes.sentBy).to.equal(o.getClientID());
            expect(changes.fromVersion).to.equal(o.getDocVersion());
            expect(changes.changes).not.to.be.a("null");
            expect(changes.changes!.foo).to.equal("baz");
        });

        it("should initialize from a changes object", () => {
            const c1 = minisync.from({foo: {bar: {baz: 42}}});
            const changes = c1.getChanges();
            const c2 = minisync.from(changes);
            compareObjects(getData(c1), getData(c2));
            expect(c1.getID()).to.equal(c2.getID());
        });

        it("should merge changes for objects", () => {
            // initial sync
            const client1 = minisync.from({foo: 1, bar: 1});
            const client2 = minisync.from(client1.getChanges());
            compareObjects(getData(client1), getData(client2));
            // replacing non-object value with object value
            client2.set("bar", { baz: "test" });
            client1.applyChanges(client2.getChangesForClient(client1.getClientID()));
            compareObjects(getData(client1), getData(client2));
            // updating only a nested property
            client2.get("bar").set("baz", "changed");
            client1.applyChanges(client2.getChangesForClient(client1.getClientID()));
            compareObjects(getData(client2), getData(client1));
            // one more sync to make client2 realize client1 got all the updates
            client2.applyChanges(client1.getChangesForClient(client2.getClientID()));
            compareObjects(getData(client1), getData(client2));
            expect(client1.getChangesForClient(client2.getClientID()).changes).to.be.a("null");
            expect(client2.getChangesForClient(client1.getClientID()).changes).to.be.a("null");
        });

        it("should merge changes without knowing client id", () => {
            // initial sync
            const client1 = minisync.from({foo: 1, bar: 1});
            const client2 = minisync.from(client1.getChanges());
            compareObjects(getData(client1), getData(client2));
            // replacing non-object value with object value
            client2.set("bar", { baz: "test" });
            client1.applyChanges(client2.getChanges());
            compareObjects(getData(client1), getData(client2));
            // updating only a nested property
            client2.get("bar").set("baz", "changed");
            client1.applyChanges(client2.getChanges());
            compareObjects(getData(client2), getData(client1));
            // one more sync to make client2 realize client1 got all the updates
            client2.applyChanges(client1.getChanges());
            compareObjects(getData(client1), getData(client2));
            // are they really synchronized?
            expect(client1.getChanges(client2.getClientID()).changes).to.be.a("null");
            expect(client2.getChanges(client1.getClientID()).changes).to.be.a("null");
        });

        it("should merge client states across 3 clients", () => {
            const client1 = minisync.from({foo: 1});
            const client2 = minisync.from(client1.getChanges());
            const client3 = minisync.from(client2.getChanges());
            compareObjects(getData(client1), getData(client3));
            expect(client3.getChangesForClient(client1.getClientID()).changes).to.be.a("null");

            client3.set("foo", 2);
            client1.applyChanges(client3.getChangesForClient(client1.getClientID()));
            compareObjects(getData(client1), getData(client3));
        });

        it("should merge removed objects", () => {
            const client1 = minisync.from({foo: {o: 1}, bar: {o: 2}});
            const client2 = minisync.from(client1.getChanges());
            compareObjects(getData(client1), getData(client2));
            client1.get("bar").remove();
            client2.applyChanges(client1.getChanges());
            expect(client2.get("bar")).to.be.a("null");
        });

        it("should implement the example from the readme", () => {
            let alice = minisync.from({ foo: "initial state goes here" });
            // this client is known as "alice"
            (alice as any).setClientID("alice");
            // make changes
            alice.set("foo", {bar: ["baz"]});
            alice.set("foo.bar[1]", "quu");
            // get a changes object that contains everything (can be sent to any client)
            const changes = JSON.parse(JSON.stringify(alice.getChanges()));

            // create document initially from master changes object received from alice
            const bob = minisync.from(changes);
            // this client is known as bob
            (bob as any).setClientID("bob");
            // make a change
            bob.get("foo.bar").push("foo you too");
            // make delta object for alice
            const bobsdelta = JSON.stringify(bob.getChangesForClient("alice"));

            alice = minisync.restore(changes);
            // receive changes from bob
            alice.applyChanges(JSON.parse(bobsdelta));

            // should be identical at this point
            compareObjects(getData(alice), getData(bob));

            // make a change
            alice.set("foo.bar", []);
            // get a changes object for bob (delta containing only changes new to bob)
            const alicesdelta = JSON.stringify(alice.getChangesForClient("bob"));

            // merge delta changes from alice
            bob.applyChanges(JSON.parse(alicesdelta));

            // should be identical again
            compareObjects(getData(alice), getData(bob));
        });

        describe("array synchronization", () => {
            it("should initialize from a changes object", () => {
                const c1 = minisync.from({a: [{o: 1}, {o: 2}, {o: 3}]});
                const c2 = minisync.from(c1.getChanges());
                compareObjects(getData(c1), getData(c2));
            });

            it("should merge intervals", () => {
                const a = minisync.from({a: [{foo: "bar"}, "test", {foo: "baz"}]}).get("a");
                const id1 = a.get(0).getID();
                const id2 = a.get(2).getID();
                a.mergeInterval({after: id1, before: id2, values: ["test2", "test3"]});
                expect(a.length()).to.equal(4);
                expect(a.get(1)).to.equal("test2");
                expect(a.get(2)).to.equal("test3");
            });

            it("should extract intervals", () => {
                const c1 = minisync.from({a: [{o: 1}, {o: 2}, {o: 3}]});
                const c2 = minisync.from(c1.getChanges());
                c1.get("a").splice(2, 0, 3, 4);
                c1.get("a").splice(1, 0, 1, 2);
                c1.get("a").push(5);
                // c1 = {a: [{o:1},1,2,{o:2},3,4,{o:3},5]}
                // note that empty intervals are not merged,
                // so there is no interval before the first object
                const expectedIntervals = [
                    {after: c2.get("a[0]").getID(), before: c2.get("a[1]").getID(), values: [1, 2]},
                    {after: c2.get("a[1]").getID(), before: c2.get("a[2]").getID(), values: [3, 4]},
                    {after: c2.get("a[2]").getID(), before: null, values: [5]}
                ];
                let expectedIntervalIndex = 0;
                try {
                    sinon.replace(SyncableArray.prototype, "mergeInterval",
                        (interval: any) => {
                            const expectedInterval = expectedIntervals[expectedIntervalIndex++];
                            compareObjects(interval, expectedInterval);
                        }
                    );
                    c2.applyChanges(c1.getChanges());
                    expect(expectedIntervalIndex).to.equal(3);
                } finally {
                    sinon.restore();
                }
            });

            it("should synchronize primitive values", () => {
                const c1 = minisync.from({a: ["test", 123, false]});
                const c2 = minisync.from(c1.getChanges());
                compareObjects(getData(c1), getData(c2));
                c2.set("a[1]", 321);
                c2.applyChanges(c1.getChanges());
                expect(c2.get("a[1]")).to.equal(321);
                c2.get("a").pop();
                c1.applyChanges(c2.getChanges());
                compareObjects(getData(c1), getData(c2));
            });

            it("should synchronize object values", () => {
                const c1 = minisync.from({a: [{foo: "bar"}, {foo: "baz"}]});
                const c2 = minisync.from(c1.getChanges());
                compareObjects(getData(c1), getData(c2));
                // make sure they"re fully synchronized
                c1.applyChanges(c2.getChanges());
                // this doesn"t update the array, but should still sync
                c2.set("a[1].foo", {nested: true});
                c1.applyChanges(c2.getChanges());
                compareObjects(getData(c1), getData(c2));
            });

            it("should keep new local object values", () => {
                const c1 = minisync.from({ a: [{o: 1}, {o: 2}]});
                const c2 = minisync.from(c1.getChanges());
                c1.set("a[1].o", 3);
                c1.get("a").splice(1, 0, 5);
                c2.get("a").splice(1, 0, {l: 1});
                c2.applyChanges(c1.getChanges());
                expect(c2.get("a").length()).to.equal(4);
                expect(c2.get("a[0].o")).to.equal(1);
                expect(c2.get("a[1]")).to.equal(5);
                expect(c2.get("a[2].l")).to.equal(1);
                expect(c2.get("a[3].o")).to.equal(3);
            });

            it("should synchronize in both directions", () => {
                const c1 = minisync.from({ a: [{o: 1}, {o: 2}]});
                const c2 = minisync.from(c1.getChanges());
                const a1 = c1.get("a");
                a1.splice(1, 0, {r: 1});
                a1.push({r: 2});
                const a2 = c2.get("a");
                a2.splice(1, 0, {l: 1});
                a2.unshift({l: 2});
                c2.applyChanges(c1.getChanges());
                // c2.a = [{l:2},{o:1},{r:1},{l:1},{o:2},{r:2}]
                expect(c2.get("a").length()).to.equal(6);
                expect(c2.get("a[0].l")).to.equal(2);
                expect(c2.get("a[1].o")).to.equal(1);
                expect(c2.get("a[2].r")).to.equal(1);
                expect(c2.get("a[3].l")).to.equal(1);
                expect(c2.get("a[4].o")).to.equal(2);
                expect(c2.get("a[5].r")).to.equal(2);
                c1.applyChanges(c2.getChanges());
                compareObjects(c1.getData(), c2.getData());
            });

            it("should merge removed objects", () => {
                const c1 = minisync.from({a: [{o: 1}, {o: 2}, {o: 3}]});
                const c2 = minisync.from(c1.getChanges());
                c1.get("a").splice(1, 1);
                c2.applyChanges(c1.getChanges());
                expect(c2.get("a").length()).to.equal(2);
                expect(c2.get("a[0].o")).to.equal(1);
                expect(c2.get("a[1].o")).to.equal(3);
            });
        });
    });

    describe("persistence", () => {
        it("should persist and restore", () => {
            const o1 = minisync.from({
                foo: "bar",
                baz: [
                    "quu",
                    { qux: "xyzzy"}
                ]
            });
            // create a remote client state
            o1.getChangesForClient("alice");
            const s = JSON.parse(JSON.stringify(o1.getChanges()));
            const o2 = minisync.restore(s);
            // o1 and o2 should be identical
            expect(o2.getClientID()).to.equal(o1.getClientID());
            expect(o2.getDocVersion()).to.equal(o1.getDocVersion());
            compareObjects(getData(o1), getData(o2), true);
        });
    });

    describe("proxy", () => {
        it("should synchronize after nested changes", () => {
            const o1 = minisync.from({
                foo: "bar",
                bar: [ "quu", {
                    baz: "qux"
                }]
            });
            // does it look right?
            const p = o1.getProxy();
            expect(p.foo).to.equal("bar");
            expect(p.bar).to.be.an("array");
            expect(p.bar.length).to.equal(2);
            expect(p.bar[0]).to.equal("quu");
            expect(p.bar[1]).to.be.an("object");
            expect(p.bar[1].baz).to.equal("qux");
            // change it, sync it, and check it looks fine
            p.foo = "a";
            p.bar[0] = "b";
            p.bar[1].baz = "c";
            p.quu = "d";
            const c2 = minisync.from(o1.getChanges());
            compareObjects(c2.getData(), {
                foo: "a",
                bar: ["b", {
                    baz: "c"
                }],
                quu: "d"
            });
            delete p.quu;
            c2.applyChanges(o1.getChanges());
            expect(c2.getData().quu).to.be.an("undefined");
        });

        it("should support array methods", () => {
            const o = minisync.from({
                foo: ["bar", "baz"]
            });
            const originalVersion = o.getDocVersion();
            const p = o.getProxy();

            expect(p.foo.slice(0, 1)).to.eql(["bar"]);
            expect(o.getDocVersion()).to.equal(originalVersion);
            try {
                sinon.spy(SyncableArray.prototype, "push");
                // inject data through a method, should have incremented the document version
                p.foo.push("xyzzy");
                expect(p.foo).to.eql(["bar", "baz", "xyzzy"]);
                expect(o.getDocVersion()).not.to.equal(originalVersion);
                // and should have called our own push method
                expect((SyncableArray.prototype.push as any).callCount).to.equal(1);
            } finally {
                (SyncableArray.prototype.push as any).restore();
            }
        });
    });

});
