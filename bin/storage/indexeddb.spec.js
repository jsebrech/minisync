(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "chai", "../minisync", "../test-utils", "./index", "./index"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var chai = require("chai");
    var minisync = require("../minisync");
    var test_utils_1 = require("../test-utils");
    var storage = require("./index");
    var index_1 = require("./index");
    var expect = chai.expect;
    describe("minisync storage", function () {
        describe("IndexedDB", function () {
            var store;
            before(function () {
                store = new index_1.IndexedDBStore("test");
            });
            beforeEach(function (done) {
                // clear database
                store.openDB().then(function (db) {
                    db.transaction("files", "readwrite").objectStore("files").clear().onsuccess = function () {
                        done();
                    };
                });
            });
            function putFile(path, file, contents) {
                return store.openDB().then(function (db) {
                    return db.transaction("files", "readwrite").objectStore("files").put({
                        name: file,
                        path: path,
                        file: { path: [path], fileName: file, contents: contents }
                    }, path + "/" + file);
                });
            }
            it("should load a file", function (done) {
                putFile("path", "file", "foo").then(function (req) {
                    req.onsuccess = function () {
                        store.getFile({ path: ["path"], fileName: "file" }).then(function (result) {
                            expect(typeof result).to.equal("object");
                            expect(typeof result.path).to.equal("object");
                            expect(result.path[0]).to.equal("path");
                            expect(result.fileName).to.equal("file");
                            expect(result.contents).to.equal("foo");
                            done();
                        });
                    };
                });
            });
            it("should save a file", function (done) {
                store.putFile({
                    path: ["path"],
                    fileName: "file2",
                    contents: "bar"
                }).then(function (result) {
                    expect(result).to.equal(true);
                    store.openDB().then(function (db) {
                        var req = db.transaction("files").objectStore("files").get("path/file2");
                        req.onsuccess = function (e) {
                            expect(e).to.be.an("object");
                            expect(e.target).to.be.an("object");
                            var res = e.target.result;
                            expect(res).to.be.an("object");
                            expect(res.file).to.be.an("object");
                            expect(res.path).to.equal("path");
                            expect(res.name).to.equal("file2");
                            expect(res.file.path[0]).to.equal("path");
                            expect(res.file.fileName).to.equal("file2");
                            expect(res.file.contents).to.equal("bar");
                            done();
                        };
                    });
                });
            });
            it("should load several files", function (done) {
                Promise.all([
                    putFile("path", "file1", "foo"),
                    putFile("path", "file2", "foo")
                ]).then(function (reqs) {
                    reqs[1].onsuccess = function () {
                        var data = [
                            { path: ["path"], fileName: "file1" },
                            { path: ["path"], fileName: "file2" }
                        ];
                        store.getFiles(data).then(function (result) {
                            data[0].contents = data[1].contents = "foo";
                            expect(typeof result).to.equal("object");
                            expect(result).to.deep.equal(data);
                            done();
                        });
                    };
                });
            });
            it("should save and restore a document", function (done) {
                var original = minisync.from({ v: [1, 2, { foo: "bar" }, 4, 5] });
                storage.save(original, store).then(function (documentID) {
                    return storage.restore(documentID, store);
                }).then(function (restored) {
                    test_utils_1.compareObjects(test_utils_1.getData(original), test_utils_1.getData(restored));
                    expect(original.getClientID()).to.equal(restored.getClientID());
                    done();
                }).catch(function (reason) {
                    done(new Error(reason));
                });
            });
        });
    });
});
//# sourceMappingURL=indexeddb.spec.js.map