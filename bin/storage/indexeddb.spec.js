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
    // load indexeddb in node environment
    // https://github.com/axemclion/IndexedDBShim
    // tslint:disable-next-line:no-var-requires
    var setGlobalVars = require("indexeddbshim");
    global.window = global;
    setGlobalVars(null, {
        checkOrigin: false
    });
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
                }).catch(function (e) { return done(new Error(e)); });
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
                        }).catch(function (e) { return done(new Error(e)); });
                    };
                }).catch(function (e) { return done(new Error(e)); });
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
                        req.onerror = done;
                        req.onsuccess = function (e) {
                            try {
                                expect(typeof e).to.equal("object");
                                expect(typeof e.target).to.equal("object");
                                var res_1 = e.target.result;
                                expect(typeof res_1).to.equal("object");
                                expect(res_1.file).to.be.an("object");
                                expect(res_1.path).to.equal("path");
                                expect(res_1.name).to.equal("file2");
                                expect(res_1.file.path[0]).to.equal("path");
                                expect(res_1.file.fileName).to.equal("file2");
                                expect(res_1.file.contents).to.equal("bar");
                                done();
                            }
                            catch (err) {
                                done(err);
                            }
                        };
                    });
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("should save and restore a document", function (done) {
                var original = minisync.from({ v: [1, 2, { foo: "bar" }, 4, 5] });
                storage.saveLocal(original, store).then(function (documentID) {
                    return storage.restoreLocal(documentID, store);
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