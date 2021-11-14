import * as minisync from "./minisync";
import { dateToString } from "./types";

import * as chai from "chai";

const expect = chai.expect;

// don't log debug output
minisync.defaultLogger().level = 'warn';

describe("minisync core", () => {

    describe("object handling", () => {

        it("should initialize properly", () => {
            const data = { foo: "bar" };
            const o = minisync.from(data);
            expect(o).to.be.an("object");
            expect(o.getData).not.to.be.an("undefined");
            const oData = o.getData();
            expect(oData).to.be.an("object");
            expect(oData.foo).to.equal("bar");
            expect(o.getID()).not.to.be.a("null");
            expect(o.getTimeStamp()).to.be.a("string");
            expect(o.getTimeStamp().length).to.equal(14);
        });

        it("should return properties", () => {
            const data = { foo: "bar", baz: { foo: "quu" } };
            const o = minisync.from(data);
            expect(o.get("foo")).to.equal("bar");
            expect(o.get("baz").get).not.to.be.a("null");
            expect(o.get("baz").get("foo")).to.equal("quu");
        });

        it("should update properties", () => {
            const data: any = { foo: "bar" };
            const o = minisync.from(data);
            let oldVersion = o.getDocVersion();
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

        it("should return a raw data object", () => {
            const o = minisync.from({foo: "bar"});
            o.set("bar", "baz");
            o.set("baz", { foo: "bar" });
            const data: any = o.getData();
            expect(data).to.be.an("object");
            expect(data._s).to.be.an("undefined");
            expect(data.foo).to.equal("bar");
            expect(data.bar).to.equal("baz");
            expect(data.baz).to.be.an("object");
            expect(data.baz._s).to.be.an("undefined");
            expect(data.baz.foo).to.equal("bar");
        });

        it("should have smart get and set syntax", () => {
            const data: any = { foo: "bar", baz: { foo: "quu" } };
            const o = minisync.from(data);
            expect(o.get("baz.foo")).to.equal("quu");
            o.set("baz.foo", {test: "bingo"});
            expect(data.baz.foo.test).to.equal("bingo");
            expect(o.get("baz.foo.test")).to.equal("bingo");
        });

        it("should update properties in child objects", () => {
            const data = { child: { foo: "bar" }};
            const o = minisync.from(data);
            const oldVersion = o.getVersion(); // version for master object
            const oldDocVersion = o.getDocVersion(); // version for document
            const oldChildVersion = o.get("child").getVersion(); // version for child object
            o.get("child").set("foo", "baz");
            expect(data.child.foo).to.equal("baz");
            expect(o.getVersion()).to.equal(oldVersion);
            expect(o.getDocVersion()).not.to.equal(oldDocVersion);
            expect(o.get("child").getVersion()).not.to.equal(oldChildVersion);
        });

        it("should handle removed objects", () => {
            const o = minisync.from({foo: { bar: { baz: "quu" } }});
            o.get("foo").get("bar").remove();
            const d = o.getData();
            expect(d).to.be.an("object");
            expect(d.foo).to.be.an("object");
            expect(d.foo.bar).to.be.an("undefined");
        });

        it("should know what changed", () => {
            const data = {
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
            const o = minisync.from(data);
            const initialVersion = o.getDocVersion();
            let changes = o.getChangesSince(initialVersion);
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

    describe("array handling", () => {

        it("should support get() and set()", () => {
            const a = minisync.from({a: []}).get("a");
            a.set(0, "foo");
            a.set(2, "bar");
            const data = a.getData();
            expect(data).to.be.an("array");
            expect(data.length).to.equal(3);
            expect(data[0]).to.equal("foo");
            expect(data[2]).to.equal("bar");
            expect(a.get(0)).to.equal("foo");
            expect(a.get("0")).to.equal("foo");
            expect(a.get("2")).to.equal("bar");
        });

        it("should support nested get() and set()", () => {
            const o = minisync.from({foo: [null, "bar"]});
            expect(o.get("foo[1]")).to.equal("bar");
            o.set("foo[1]", "baz");
            expect(o.get("foo").getData()).to.be.an("array");
            expect(o.get("foo").get(1)).to.equal("baz");
            expect(o.get("foo[1]")).to.equal("baz");
            o.set("foo[1]", ["test"]);
            o.set("foo[1][2]", "bar");
            expect(o.get("foo[1][2]")).to.equal("bar");
            const data = o.get("foo[1]").getData();
            expect(data).to.be.an("array");
            expect(data.length).to.equal(3);
            expect(data[2]).to.equal("bar");
            o.get("foo").set("[1][2]", "baz");
            expect(o.get("foo[1][2]")).to.equal("baz");
        });

        it("should return raw data", () => {
            const o = minisync.from({ test: ["bar", {foo: "bar"}]});
            const data = o.getData().test;
            expect(data).to.be.an("array");
            expect(data.length).to.equal(2);
            expect(data._s).to.be.an("undefined");
            expect(data[0]).to.equal("bar");
            expect(data[1]).to.be.an("object");
            expect(data[1].foo).to.equal("bar");
            expect(data[1]._s).to.be.an("undefined");
        });

        it("should keep track of removed items", () => {
            const data = minisync.from({ v: [{foo: "bar"}, {bar: "baz"}]}).get("v");
            expect(data.getData().length).to.equal(2);
            const itemID = data.get(0).getID();
            const updatedAt = data.getState().u;
            data.removeAt(0);
            expect(data.getData().length).to.equal(1);
            expect(data.getState().u).not.to.equal(updatedAt);
            expect(data.getRemoved()).to.be.an("array");
            expect(data.getRemoved().length).to.equal(1);
            expect(data.getRemoved()[0].id).to.equal(itemID);
        });

        it("should implement concat", () => {
            const v = minisync.from({v: ["one", "two"]}).get("v");
            expect(v.concat).not.to.be.an("undefined");
            const a = v.concat(["three"]);
            expect(a).to.be.an("array");
            expect(a.length).to.equal(3);
            expect(a[2]).to.equal("three");
        });

        it("should implement forEach", () => {
            if (Array.prototype.forEach) {
                const a = minisync.from({a: ["foo", "bar", {foo: "bar"}]}).get("a");
                let count = 0;
                a.forEach((value: any, index: number, arr: any[]) => {
                    count++;
                    switch (index) {
                        case 0: expect(value).to.equal("foo"); break;
                        case 1: expect(value).to.equal("bar"); break;
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
                expect(count).to.equal(3);
            }
        });

        it("should implement indexOf", () => {
            const orig = ["one", "two", { key: "three"}, "four"];
            const a = minisync.from({test: orig}).get("test");
            expect(a.indexOf).not.to.be.an("undefined");
            for (let i = 0; i < orig.length; i++) {
                expect(a.indexOf(orig[i])).to.equal(i);
            }
            const obj = a.get(2);
            expect(a.indexOf(obj)).to.equal(2);
        });

        it("should implement pop", () => {
            const a = minisync.from({v: ["one", {foo: "bar"}, {foo: "baz"}]}).get("v");
            const item = a.pop();
            expect(a.getData().length).to.equal(2);
            expect(item).not.to.be.a("null");
            expect(item.foo).to.equal("baz");
        });

        it("should implement push", () => {
            const a = minisync.from({v: []}).get("v");
            a.push("foo", "bar");
            expect(a.getData().length).to.equal(2);
            expect(a.get(0)).to.equal("foo");
            expect(a.get(1)).to.equal("bar");
        });

        it("should implement reverse", () => {
            const a = minisync.from({v: [1, 2, 3]}).get("v");
            expect(a.reverse().join("")).to.equal("321");
        });

        it("should implement shift", () => {
            const a = minisync.from({v: [{ foo: "bar"}, 2, 3]}).get("v");
            expect(a.getData().length).to.equal(3);
            const v = a.shift();
            expect(a.getData().length).to.equal(2);
            expect(a.join("")).to.equal("23");
            expect(v).to.be.an("object");
            expect(v.foo).to.equal("bar");
        });

        it("should implement splice", () => {
            const a = minisync.from({v: [1, 2, {foo: 3}, 4, 5]}).get("v");
            const res = a.splice(2, 2, 3, {bar: 4});
            expect(res).to.be.an("array");
            expect(res.length).to.equal(2);
            expect(res[0]).to.be.an("object");
            expect(res[0].foo).to.equal(3);
            expect(res[1]).to.equal(4);
            expect(a.get(2)).to.equal(3);
            expect(a.get(3)).to.be.an("object");
            expect(a.get("[3].bar")).to.equal(4);
        });

        it("should implement unshift", () => {
            const a = minisync.from({v: [2]}).get("v");
            expect(a.unshift(1)).to.equal(2);
            expect(a.join(",")).to.equal("1,2");
        });

        it("should implement sort", () => {
            const a = minisync.from({v: [1, {v: 2}, -1]}).get("v");
            let sorted = a.sort();
            expect(sorted[0]).to.equal(-1);
            expect(sorted[1]).to.equal(1);
            expect(sorted[2]).to.be.an("object");
            sorted = a.sort((first: any, second: any) => {
                first = first.v || first;
                second = second.v || second;
                if (String(first) < String(second)) return 1;
                if (String(first) > String(second)) return -1;
                return 0;
            });
            expect(sorted[0]).to.be.an("object");
            expect(sorted[1]).to.equal(1);
            expect(sorted[2]).to.equal(-1);
        });
    });

    describe("dateToString", () => {
        it("should output a valid date string", () => {
            const date = new Date();
            date.setUTCFullYear(2011);
            date.setUTCMonth(11);
            date.setUTCDate(19);
            date.setUTCHours(22);
            date.setUTCMinutes(15);
            date.setUTCSeconds(0);
            const dateStr = dateToString(date);
            expect(dateStr).to.equal("20111219221500");
        });
    });

});
