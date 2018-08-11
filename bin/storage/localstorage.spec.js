(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "chai", "../minisync", "../test-utils", "./index"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var chai = require("chai");
    var minisync = require("../minisync");
    var test_utils_1 = require("../test-utils");
    var storage = require("./index");
    // load localstorage shim
    // tslint:disable-next-line:no-var-requires
    require("localstorage-polyfill");
    var expect = chai.expect;
    describe("minisync storage", function () {
        describe("localStorage", function () {
            var store;
            before(function () {
                store = new storage.LocalStorageStore("test");
            });
            beforeEach(function () {
                window.localStorage.clear();
            });
            it("should load a file", function (done) {
                window.localStorage.setItem("test//path/file", "foo");
                store.getFile({ path: ["path"], fileName: "file" }).then(function (result) {
                    expect(typeof result).to.equal("object");
                    expect(typeof result.path).to.equal("object");
                    expect(result.path[0]).to.equal("path");
                    expect(result.fileName).to.equal("file");
                    expect(result.contents).to.equal("foo");
                    done();
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("should save a file", function (done) {
                store.putFile({
                    path: ["path"],
                    fileName: "file2",
                    contents: "bar"
                }).then(function (result) {
                    expect(result).to.equal(true);
                    expect(window.localStorage.getItem("test//path/file2")).to.equal("bar");
                    done();
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("should load several files", function (done) {
                window.localStorage.setItem("test//path/file1", "foo");
                window.localStorage.setItem("test//path/file2", "foo");
                var data = [
                    { path: ["path"], fileName: "file1" },
                    { path: ["path"], fileName: "file2" }
                ];
                store.getFiles(data).then(function (result) {
                    data[0].contents = data[1].contents = "foo";
                    expect(result).to.be.an("array");
                    expect(result).to.deep.equal(data);
                    done();
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("should save and restore a document", function (done) {
                var original = minisync.from({ v: [1, 2, { foo: "bar" }, 4, 5] });
                storage.save(original, store).then(function (documentID) {
                    return storage.restore(documentID, store);
                }).then(function (restored) {
                    test_utils_1.compareObjects(test_utils_1.getData(original), test_utils_1.getData(restored));
                    expect(original.getClientID()).to.equal(restored.getClientID());
                    done();
                }).catch(function (e) { return done(new Error(e)); });
            });
        });
    });
});
//# sourceMappingURL=localstorage.spec.js.map