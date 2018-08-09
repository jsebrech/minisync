(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./minisync", "./test-utils", "chai", "sinon", "./syncable"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var minisync = require("./minisync");
    var test_utils_1 = require("./test-utils");
    var chai = require("chai");
    var sinon = require("sinon");
    var syncable_1 = require("./syncable");
    var expect = chai.expect;
    describe("minisync p2p", function () {
        describe("client interaction", function () {
            it("should have a unique client id", function () {
                var c1 = minisync.from({ foo: "bar" });
                var c2 = minisync.from({ foo: "bar" });
                var id1 = c1.getClientID();
                expect(id1).not.to.be.a("null");
                expect(id1).to.be.a("string");
                expect(id1.length).to.equal(16);
                expect(id1).to.equal(c1.getClientID());
                expect(c1).not.to.equal(c2.getClientID());
            });
            it("should obtain changes", function () {
                var o = minisync.from({ foo: "bar" });
                var changes = o.getChanges("client1");
                expect(changes).not.to.be.a("null");
                expect(changes.sentBy).to.equal(o.getClientID());
                expect(changes.fromVersion).to.equal(o.getDocVersion());
                expect(changes.changes).not.to.be.a("null");
                expect(changes.changes.foo).to.equal("bar");
                o.set("foo", "baz");
                changes = o.getChanges("client1");
                expect(changes).not.to.be.a("null");
                expect(changes.sentBy).to.equal(o.getClientID());
                expect(changes.fromVersion).to.equal(o.getDocVersion());
                expect(changes.changes).not.to.be.a("null");
                expect(changes.changes.foo).to.equal("baz");
            });
            it("should initialize from a changes object", function () {
                var c1 = minisync.from({ foo: { bar: { baz: 42 } } });
                var c2 = minisync.from(c1.getChanges());
                test_utils_1.compareObjects(test_utils_1.getData(c1), test_utils_1.getData(c2));
            });
            it("should merge changes for objects", function () {
                // initial sync
                var client1 = minisync.from({ foo: 1, bar: 1 });
                var client2 = minisync.from();
                client2.mergeChanges(client1.getChanges(client2.getClientID()));
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client2));
                // replacing non-object value with object value
                client2.set("bar", { baz: "test" });
                client1.mergeChanges(client2.getChanges(client1.getClientID()));
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client2));
                // updating only a nested property
                client2.get("bar").set("baz", "changed");
                client1.mergeChanges(client2.getChanges(client1.getClientID()));
                test_utils_1.compareObjects(test_utils_1.getData(client2), test_utils_1.getData(client1));
                // one more sync to make client2 realize client1 got all the updates
                client2.mergeChanges(client1.getChanges(client2.getClientID()));
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client2));
                expect(client1.getChanges(client2.getClientID()).changes).to.be.a("null");
                expect(client2.getChanges(client1.getClientID()).changes).to.be.a("null");
            });
            it("should merge changes without knowing client id", function () {
                // initial sync
                var client1 = minisync.from({ foo: 1, bar: 1 });
                var client2 = minisync.from();
                client2.mergeChanges(client1.getChanges());
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client2));
                // replacing non-object value with object value
                client2.set("bar", { baz: "test" });
                client1.mergeChanges(client2.getChanges());
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client2));
                // updating only a nested property
                client2.get("bar").set("baz", "changed");
                client1.mergeChanges(client2.getChanges());
                test_utils_1.compareObjects(test_utils_1.getData(client2), test_utils_1.getData(client1));
                // one more sync to make client2 realize client1 got all the updates
                client2.mergeChanges(client1.getChanges());
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client2));
                // are they really synchronized?
                expect(client1.getChanges(client2.getClientID()).changes).to.be.a("null");
                expect(client2.getChanges(client1.getClientID()).changes).to.be.a("null");
            });
            it("should merge client states across 3 clients", function () {
                var client1 = minisync.from({ foo: 1 });
                var client2 = minisync.from(client1.getChanges());
                var client3 = minisync.from(client2.getChanges());
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client3));
                expect(client3.getChanges(client1.getClientID()).changes).to.be.a("null");
                client3.set("foo", 2);
                client1.mergeChanges(client3.getChanges(client1.getClientID()));
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client3));
            });
            it("should merge removed objects", function () {
                var client1 = minisync.from({ foo: { o: 1 }, bar: { o: 2 } });
                var client2 = minisync.from(client1.getChanges());
                test_utils_1.compareObjects(test_utils_1.getData(client1), test_utils_1.getData(client2));
                client1.get("bar").remove();
                client2.mergeChanges(client1.getChanges());
                expect(client2.get("bar")).to.be.a("null");
            });
            it("should implement the example from the readme", function () {
                var alice = minisync.from({ foo: "initial state goes here" });
                // this client is known as "alice"
                alice.setClientID("alice");
                // make changes
                alice.set("foo", { bar: ["baz"] });
                alice.set("foo.bar[1]", "quu");
                // get a changes object that contains everything (can be sent to any client)
                var changes = JSON.parse(JSON.stringify(alice.getChanges()));
                // create document initially from master changes object received from alice
                var bob = minisync.from(changes);
                // this client is known as bob
                bob.setClientID("bob");
                // make a change
                bob.get("foo.bar").push("foo you too");
                // make delta object for alice
                var bobsdelta = JSON.stringify(bob.getChanges("alice"));
                alice = minisync.restore(changes);
                // receive changes from bob
                alice.mergeChanges(JSON.parse(bobsdelta));
                // should be identical at this point
                test_utils_1.compareObjects(test_utils_1.getData(alice), test_utils_1.getData(bob));
                // make a change
                alice.set("foo.bar", []);
                // get a changes object for bob (delta containing only changes new to bob)
                var alicesdelta = JSON.stringify(alice.getChanges("bob"));
                // merge delta changes from alice
                bob.mergeChanges(JSON.parse(alicesdelta));
                // should be identical again
                test_utils_1.compareObjects(test_utils_1.getData(alice), test_utils_1.getData(bob));
            });
            describe("array synchronization", function () {
                it("should initialize from a changes object", function () {
                    var c1 = minisync.from({ a: [{ o: 1 }, { o: 2 }, { o: 3 }] });
                    var c2 = minisync.from(c1.getChanges());
                    test_utils_1.compareObjects(test_utils_1.getData(c1), test_utils_1.getData(c2));
                });
                it("should merge intervals", function () {
                    var a = minisync.from({ a: [{ foo: "bar" }, "test", { foo: "baz" }] }).get("a");
                    var id1 = a.get(0).getID();
                    var id2 = a.get(2).getID();
                    a.mergeInterval({ after: id1, before: id2, values: ["test2", "test3"] });
                    expect(a.length()).to.equal(4);
                    expect(a.get(1)).to.equal("test2");
                    expect(a.get(2)).to.equal("test3");
                });
                it("should extract intervals", function () {
                    var c1 = minisync.from({ a: [{ o: 1 }, { o: 2 }, { o: 3 }] });
                    var c2 = minisync.from(c1.getChanges());
                    c1.get("a").splice(2, 0, 3, 4);
                    c1.get("a").splice(1, 0, 1, 2);
                    c1.get("a").push(5);
                    // c1 = {a: [{o:1},1,2,{o:2},3,4,{o:3},5]}
                    // note that empty intervals are not merged,
                    // so there is no interval before the first object
                    var expectedIntervals = [
                        { after: c2.get("a[0]").getID(), before: c2.get("a[1]").getID(), values: [1, 2] },
                        { after: c2.get("a[1]").getID(), before: c2.get("a[2]").getID(), values: [3, 4] },
                        { after: c2.get("a[2]").getID(), before: null, values: [5] }
                    ];
                    var expectedIntervalIndex = 0;
                    sinon.replace(syncable_1.SyncableArray.prototype, "mergeInterval", function (interval) {
                        var expectedInterval = expectedIntervals[expectedIntervalIndex++];
                        test_utils_1.compareObjects(interval, expectedInterval);
                    });
                    c2.mergeChanges(c1.getChanges());
                    expect(expectedIntervalIndex).to.equal(3);
                    sinon.restore();
                });
                it("should synchronize primitive values", function () {
                    var c1 = minisync.from({ a: ["test", 123, false] });
                    var c2 = minisync.from({});
                    c2.mergeChanges(c1.getChanges());
                    test_utils_1.compareObjects(test_utils_1.getData(c1), test_utils_1.getData(c2));
                    c2.set("a[1]", 321);
                    c2.mergeChanges(c1.getChanges());
                    expect(c2.get("a[1]")).to.equal(321);
                    c2.get("a").pop();
                    c1.mergeChanges(c2.getChanges());
                    test_utils_1.compareObjects(test_utils_1.getData(c1), test_utils_1.getData(c2));
                });
                it("should synchronize object values", function () {
                    var c1 = minisync.from({ a: [{ foo: "bar" }, { foo: "baz" }] });
                    var c2 = minisync.from(c1.getChanges());
                    test_utils_1.compareObjects(test_utils_1.getData(c1), test_utils_1.getData(c2));
                    // make sure they"re fully synchronized
                    c1.mergeChanges(c2.getChanges());
                    // this doesn"t update the array, but should still sync
                    c2.set("a[1].foo", { nested: true });
                    c1.mergeChanges(c2.getChanges());
                    test_utils_1.compareObjects(test_utils_1.getData(c1), test_utils_1.getData(c2));
                });
                it("should keep new local object values", function () {
                    var c1 = minisync.from({ a: [{ o: 1 }, { o: 2 }] });
                    var c2 = minisync.from(c1.getChanges());
                    c1.set("a[1].o", 3);
                    c1.get("a").splice(1, 0, 5);
                    c2.get("a").splice(1, 0, { l: 1 });
                    c2.mergeChanges(c1.getChanges());
                    expect(c2.get("a").length()).to.equal(4);
                    expect(c2.get("a[0].o")).to.equal(1);
                    expect(c2.get("a[1]")).to.equal(5);
                    expect(c2.get("a[2].l")).to.equal(1);
                    expect(c2.get("a[3].o")).to.equal(3);
                });
                it("should synchronize in both directions", function () {
                    var c1 = minisync.from({ a: [{ o: 1 }, { o: 2 }] });
                    var c2 = minisync.from(c1.getChanges());
                    var a1 = c1.get("a");
                    a1.splice(1, 0, { r: 1 });
                    a1.push({ r: 2 });
                    var a2 = c2.get("a");
                    a2.splice(1, 0, { l: 1 });
                    a2.unshift({ l: 2 });
                    c2.mergeChanges(c1.getChanges());
                    // c2.a = [{l:2},{o:1},{r:1},{l:1},{o:2},{r:2}]
                    expect(c2.get("a").length()).to.equal(6);
                    expect(c2.get("a[0].l")).to.equal(2);
                    expect(c2.get("a[1].o")).to.equal(1);
                    expect(c2.get("a[2].r")).to.equal(1);
                    expect(c2.get("a[3].l")).to.equal(1);
                    expect(c2.get("a[4].o")).to.equal(2);
                    expect(c2.get("a[5].r")).to.equal(2);
                    c1.mergeChanges(c2.getChanges());
                    test_utils_1.compareObjects(c1.getData(), c2.getData());
                });
                it("should merge removed objects", function () {
                    var c1 = minisync.from({ a: [{ o: 1 }, { o: 2 }, { o: 3 }] });
                    var c2 = minisync.from(c1.getChanges());
                    c1.get("a").splice(1, 1);
                    c2.mergeChanges(c1.getChanges());
                    expect(c2.get("a").length()).to.equal(2);
                    expect(c2.get("a[0].o")).to.equal(1);
                    expect(c2.get("a[1].o")).to.equal(3);
                });
            });
        });
        describe("persistence", function () {
            it("should persist and restore", function () {
                var o1 = minisync.from({
                    foo: "bar",
                    baz: [
                        "quu",
                        { qux: "xyzzy" }
                    ]
                });
                // create a remote client state
                o1.getChanges("alice");
                var s = JSON.parse(JSON.stringify(o1.getChanges()));
                var o2 = minisync.restore(s);
                // o1 and o2 should be identical
                expect(o2.getClientID()).to.equal(o1.getClientID());
                expect(o2.getDocVersion()).to.equal(o1.getDocVersion());
                test_utils_1.compareObjects(test_utils_1.getData(o1), test_utils_1.getData(o2), true);
            });
        });
        describe("proxy", function () {
            it("should synchronize after nested changes", function () {
                var o1 = minisync.from({
                    foo: "bar",
                    bar: ["quu", {
                            baz: "qux"
                        }]
                });
                // does it look right?
                var p = o1.getProxy();
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
                var c2 = minisync.from(o1.getChanges());
                test_utils_1.compareObjects(c2.getData(), {
                    foo: "a",
                    bar: ["b", {
                            baz: "c"
                        }],
                    quu: "d"
                });
                delete p.quu;
                c2.mergeChanges(o1.getChanges());
                expect(c2.getData().quu).to.be.an("undefined");
            });
        });
    });
});
//# sourceMappingURL=syncable.spec.js.map