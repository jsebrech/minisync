(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "chai", "./index"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var chai = require("chai");
    var storage = require("./index");
    var expect = chai.expect;
    describe("minisync storage", function () {
        describe("MemoryStore", function () {
            var store;
            beforeEach(function () {
                store = new storage.MemoryStore({
                    path1: {
                        file1: "foo",
                        file2: "bar"
                    }
                });
            });
            it("should store and load a file", function (done) {
                store.putFile({
                    path: ["path2"],
                    fileName: "file",
                    contents: "foo"
                }).then(function (result) {
                    expect(result).to.equal(true);
                    store.getFile({ path: ["path2"], fileName: "file" }).then(function (result) {
                        expect(typeof result).to.equal("object");
                        expect(typeof result.path).to.equal("object");
                        expect(result.path[0]).to.equal("path2");
                        expect(result.fileName).to.equal("file");
                        expect(result.contents).to.equal("foo");
                        done();
                    }).catch(function (e) { return done(new Error(e)); });
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("should provide an error when loading an non-existent file", function (done) {
                store.getFile({ path: ["no-such-path"], fileName: "no-such-file" }).then(function (result) {
                    expect(result).to.be.a("null");
                    done();
                }).catch(function (e) { return done(e instanceof Error ? e : new Error(JSON.stringify(e))); });
            });
            it("should list files in a folder", function (done) {
                store.listFiles(["path1"]).then(function (result) {
                    expect(result.length).to.equal(2);
                    expect(result[0].fileName).to.equal("file1");
                    expect(result[1].fileName).to.equal("file2");
                    done();
                }).catch(function (e) { return done(new Error(e)); });
            });
        });
    });
});
//# sourceMappingURL=memorystore.spec.js.map