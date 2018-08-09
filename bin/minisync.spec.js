(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./minisync", "./types", "chai"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var minisync = require("./minisync");
    var types_1 = require("./types");
    var chai = require("chai");
    var expect = chai.expect;
    describe("minisync core", function () {
        describe("object handling", function () {
            it("should initialize properly", function () {
                var data = { foo: "bar" };
                var o = minisync.from(data);
                expect(o).to.be.an("object");
                expect(o.getData).not.to.be.an("undefined");
                var oData = o.getData();
                expect(oData).to.be.an("object");
                expect(oData.foo).to.equal("bar");
                expect(o.getID()).not.to.be.a("null");
                expect(o.getTimeStamp()).to.be.a("string");
                expect(o.getTimeStamp().length).to.equal(14);
            });
            it("should return properties", function () {
                var data = { foo: "bar", baz: { foo: "quu" } };
                var o = minisync.from(data);
                expect(o.get("foo")).to.equal("bar");
                expect(o.get("baz").get).not.to.be.a("null");
                expect(o.get("baz").get("foo")).to.equal("quu");
            });
            it("should update properties", function () {
                var data = { foo: "bar" };
                var o = minisync.from(data);
                var oldVersion = o.getDocVersion();
                o.set("foo", "baz");
                expect(data.foo).to.equal("baz");
                expect(data._s).not.to.be.a("null");
                expect(data._s.u).not.to.be.a("null");
                expect(o.getDocVersion()).not.to.equal(oldVersion);
                oldVersion = o.getDocVersion();
                o.set("quu", "qux");
                expect(data.quu).to.equal("qux");
                expect(o.getDocVersion()).not.to.equal(oldVersion);
            });
            it("should return a raw data object", function () {
                var o = minisync.from({ foo: "bar" });
                o.set("bar", "baz");
                o.set("baz", { foo: "bar" });
                var data = o.getData();
                expect(data).to.be.an("object");
                expect(data._s).to.be.an("undefined");
                expect(data.foo).to.equal("bar");
                expect(data.bar).to.equal("baz");
                expect(data.baz).to.be.an("object");
                expect(data.baz._s).to.be.an("undefined");
                expect(data.baz.foo).to.equal("bar");
            });
            it("should have smart get and set syntax", function () {
                var data = { foo: "bar", baz: { foo: "quu" } };
                var o = minisync.from(data);
                expect(o.get("baz.foo")).to.equal("quu");
                o.set("baz.foo", { test: "bingo" });
                expect(data.baz.foo.test).to.equal("bingo");
                expect(o.get("baz.foo.test")).to.equal("bingo");
            });
            it("should update properties in child objects", function () {
                var data = { child: { foo: "bar" } };
                var o = minisync.from(data);
                var oldVersion = o.getVersion(); // version for master object
                var oldDocVersion = o.getDocVersion(); // version for document
                var oldChildVersion = o.get("child").getVersion(); // version for child object
                o.get("child").set("foo", "baz");
                expect(data.child.foo).to.equal("baz");
                expect(o.getVersion()).to.equal(oldVersion);
                expect(o.getDocVersion()).not.to.equal(oldDocVersion);
                expect(o.get("child").getVersion()).not.to.equal(oldChildVersion);
            });
            it("should handle removed objects", function () {
                var o = minisync.from({ foo: { bar: { baz: "quu" } } });
                o.get("foo").get("bar").remove();
                var d = o.getData();
                expect(d).to.be.an("object");
                expect(d.foo).to.be.an("object");
                expect(d.foo.bar).to.be.an("undefined");
            });
            it("should know what changed", function () {
                var data = {
                    key1: "foo",
                    key2: {
                        key3: "foo",
                        key4: {
                            key5: "foo",
                            key6: {
                                key8: "foo"
                            },
                            key7: "bar"
                        }
                    }
                };
                var o = minisync.from(data);
                var initialVersion = o.getDocVersion();
                var changes = o.getChangesSince(initialVersion);
                expect(changes).to.be.a("null");
                o.set("key2.key4.key5", "changed");
                changes = o.getChangesSince(o.getDocVersion());
                expect(changes).to.be.a("null");
                changes = o.getChangesSince(initialVersion);
                expect(changes).not.to.be.a("null");
                expect(changes.key1).to.be.an("undefined");
                expect(changes.key2).not.to.be.an("undefined");
                expect(changes.key2.key3).to.be.an("undefined");
                expect(changes.key2.key4).not.to.be.an("undefined");
                expect(changes.key2.key4.key5).to.equal("changed");
                expect(changes.key2.key4.key6).to.be.an("undefined");
                expect(changes.key2.key4.key7).to.equal("bar");
            });
        });
        describe("array handling", function () {
            it("should support get() and set()", function () {
                var a = minisync.from({ a: [] }).get("a");
                a.set(0, "foo");
                a.set(2, "bar");
                var data = a.getData();
                expect(data).to.be.an("array");
                expect(data.length).to.equal(3);
                expect(data[0]).to.equal("foo");
                expect(data[2]).to.equal("bar");
                expect(a.get(0)).to.equal("foo");
                expect(a.get("0")).to.equal("foo");
                expect(a.get("2")).to.equal("bar");
            });
            it("should support nested get() and set()", function () {
                var o = minisync.from({ foo: [null, "bar"] });
                expect(o.get("foo[1]")).to.equal("bar");
                o.set("foo[1]", "baz");
                expect(o.get("foo").getData()).to.be.an("array");
                expect(o.get("foo").get(1)).to.equal("baz");
                expect(o.get("foo[1]")).to.equal("baz");
                o.set("foo[1]", ["test"]);
                o.set("foo[1][2]", "bar");
                expect(o.get("foo[1][2]")).to.equal("bar");
                var data = o.get("foo[1]").getData();
                expect(data).to.be.an("array");
                expect(data.length).to.equal(3);
                expect(data[2]).to.equal("bar");
                o.get("foo").set("[1][2]", "baz");
                expect(o.get("foo[1][2]")).to.equal("baz");
            });
            it("should return raw data", function () {
                var o = minisync.from({ test: ["bar", { foo: "bar" }] });
                var data = o.getData().test;
                expect(data).to.be.an("array");
                expect(data.length).to.equal(2);
                expect(data._s).to.be.an("undefined");
                expect(data[0]).to.equal("bar");
                expect(data[1]).to.be.an("object");
                expect(data[1].foo).to.equal("bar");
                expect(data[1]._s).to.be.an("undefined");
            });
            it("should keep track of removed items", function () {
                var data = minisync.from({ v: [{ foo: "bar" }, { bar: "baz" }] }).get("v");
                expect(data.getData().length).to.equal(2);
                var itemID = data.get(0).getID();
                var updatedAt = data.getState().u;
                data.removeAt(0);
                expect(data.getData().length).to.equal(1);
                expect(data.getState().u).not.to.equal(updatedAt);
                expect(data.getRemoved()).to.be.an("array");
                expect(data.getRemoved().length).to.equal(1);
                expect(data.getRemoved()[0].id).to.equal(itemID);
            });
            it("should implement concat", function () {
                var v = minisync.from({ v: ["one", "two"] }).get("v");
                expect(v.concat).not.to.be.an("undefined");
                var a = v.concat(["three"]);
                expect(a).to.be.an("array");
                expect(a.length).to.equal(3);
                expect(a[2]).to.equal("three");
            });
            it("should implement forEach", function () {
                if (Array.prototype.forEach) {
                    var a = minisync.from({ a: ["foo", "bar", { foo: "bar" }] }).get("a");
                    var count_1 = 0;
                    a.forEach(function (value, index, arr) {
                        count_1++;
                        switch (index) {
                            case 0:
                                expect(value).to.equal("foo");
                                break;
                            case 1:
                                expect(value).to.equal("bar");
                                break;
                            case 2:
                                expect(value).to.be.an("object");
                                expect(value.get("foo")).to.equal("bar");
                                break;
                            default:
                                break;
                        }
                        expect(arr).not.to.be.a("null");
                        expect(arr.length).to.equal(3);
                    });
                    expect(count_1).to.equal(3);
                }
            });
            it("should implement indexOf", function () {
                var orig = ["one", "two", { key: "three" }, "four"];
                var a = minisync.from({ test: orig }).get("test");
                expect(a.indexOf).not.to.be.an("undefined");
                for (var i = 0; i < orig.length; i++) {
                    expect(a.indexOf(orig[i])).to.equal(i);
                }
                var obj = a.get(2);
                expect(a.indexOf(obj)).to.equal(2);
            });
            it("should implement pop", function () {
                var a = minisync.from({ v: ["one", { foo: "bar" }, { foo: "baz" }] }).get("v");
                var item = a.pop();
                expect(a.getData().length).to.equal(2);
                expect(item).not.to.be.a("null");
                expect(item.foo).to.equal("baz");
            });
            it("should implement push", function () {
                var a = minisync.from({ v: [] }).get("v");
                a.push("foo", "bar");
                expect(a.getData().length).to.equal(2);
                expect(a.get(0)).to.equal("foo");
                expect(a.get(1)).to.equal("bar");
            });
            it("should implement reverse", function () {
                var a = minisync.from({ v: [1, 2, 3] }).get("v");
                expect(a.reverse().join("")).to.equal("321");
            });
            it("should implement shift", function () {
                var a = minisync.from({ v: [{ foo: "bar" }, 2, 3] }).get("v");
                expect(a.getData().length).to.equal(3);
                var v = a.shift();
                expect(a.getData().length).to.equal(2);
                expect(a.join("")).to.equal("23");
                expect(v).to.be.an("object");
                expect(v.foo).to.equal("bar");
            });
            it("should implement splice", function () {
                var a = minisync.from({ v: [1, 2, { foo: 3 }, 4, 5] }).get("v");
                var res = a.splice(2, 2, 3, { bar: 4 });
                expect(res).to.be.an("array");
                expect(res.length).to.equal(2);
                expect(res[0]).to.be.an("object");
                expect(res[0].foo).to.equal(3);
                expect(res[1]).to.equal(4);
                expect(a.get(2)).to.equal(3);
                expect(a.get(3)).to.be.an("object");
                expect(a.get("[3].bar")).to.equal(4);
            });
            it("should implement unshift", function () {
                var a = minisync.from({ v: [2] }).get("v");
                expect(a.unshift(1)).to.equal(2);
                expect(a.join(",")).to.equal("1,2");
            });
            it("should implement sort", function () {
                var a = minisync.from({ v: [1, { v: 2 }, -1] }).get("v");
                var sorted = a.sort();
                expect(sorted[0]).to.equal(-1);
                expect(sorted[1]).to.equal(1);
                expect(sorted[2]).to.be.an("object");
                sorted = a.sort(function (first, second) {
                    first = first.v || first;
                    second = second.v || second;
                    if (String(first) < String(second))
                        return 1;
                    if (String(first) > String(second))
                        return -1;
                    return 0;
                });
                expect(sorted[0]).to.be.an("object");
                expect(sorted[1]).to.equal(1);
                expect(sorted[2]).to.equal(-1);
            });
        });
        describe("dateToString", function () {
            it("should output a valid date string", function () {
                var date = new Date();
                date.setUTCFullYear(2011);
                date.setUTCMonth(11);
                date.setUTCDate(19);
                date.setUTCHours(22);
                date.setUTCMinutes(15);
                date.setUTCSeconds(0);
                var dateStr = types_1.dateToString(date);
                expect(dateStr).to.equal("20111219221500");
            });
        });
    });
});
//# sourceMappingURL=minisync.spec.js.map