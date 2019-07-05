(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "chai", "cross-fetch", "dropbox", "../minisync", "../test-utils", "./index", "./index", "dotenv"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var chai = require("chai");
    var cross_fetch_1 = require("cross-fetch");
    var dropbox_1 = require("dropbox");
    var minisync = require("../minisync");
    var test_utils_1 = require("../test-utils");
    var storage = require("./index");
    var index_1 = require("./index");
    var dotenv = require("dotenv");
    dotenv.config();
    var expect = chai.expect;
    describe("minisync storage", function () {
        // to test, obtain an access token from dropbox
        // see https://www.dropbox.com/developers/reference/oauth-guide
        // then put it in a .env file in the project's root (see .env.example)
        // and remove ".skip" from the test below
        var accessToken = process.env.DROPBOX_ACCESS_TOKEN;
        describe.skip("Dropbox", function () {
            var store;
            var dbx;
            var testRoot = "minisync_test_dbx";
            before(function () {
                this.timeout(5000);
                dbx = new dropbox_1.Dropbox({ accessToken: accessToken, fetch: cross_fetch_1.fetch });
                store = new index_1.DropboxStore(dbx, testRoot, cross_fetch_1.Response);
                return dbx.filesGetMetadata({ path: "/" + testRoot }).then(function () {
                    return dbx.filesDelete({ path: "/" + testRoot });
                }).catch(function () { return true; });
            });
            function putFile(path, file, contents) {
                return dbx.filesUpload({
                    path: "/" + testRoot + "/" + path + "/" + file,
                    contents: contents,
                    mode: { ".tag": "overwrite" }
                });
            }
            it("should load a file", function (done) {
                this.timeout(5000);
                putFile("path", "file", "foo").then(function () {
                    store.getFile({ path: ["path"], fileName: "file" }).then(function (result) {
                        expect(typeof result).to.equal("object");
                        expect(typeof result.path).to.equal("object");
                        expect(result.path[0]).to.equal("path");
                        expect(result.fileName).to.equal("file");
                        expect(result.contents).to.equal("foo");
                        done();
                    }).catch(function (e) { return done(new Error(e)); });
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("should save a file", function (done) {
                this.timeout(5000);
                store.putFile({
                    path: ["path"],
                    fileName: "file2",
                    contents: "bar"
                }).then(function (result) {
                    expect(result).to.equal(true);
                    // download file and check contents
                    dbx.filesDownload({
                        path: "/" + testRoot + "/path/file2"
                    }).then(function (f) {
                        // in node it returns a fileBinary
                        if (f.fileBinary) {
                            return f.fileBinary;
                            // in browser it returns a fileBlob
                        }
                        else if (f.fileBlob) {
                            return (new cross_fetch_1.Response(f.fileBlob)).text();
                        }
                        else {
                            throw new Error("no fileBinary or fileBlob in response");
                        }
                    }).then(function (t) {
                        expect(t).to.equal("bar");
                        done();
                    });
                }).catch(function (e) { return done(new Error(e)); });
            });
            it("should save and restore a document", function (done) {
                this.timeout(5000);
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
            it("should publish and download public files", function (done) {
                this.timeout(7000);
                putFile("path", "file", "foo").then(function () {
                    store.publishFile({ path: ["path"], fileName: "file" }).then(function (url) {
                        expect(typeof url).to.equal("string");
                        expect(store.canDownloadUrl(url)).to.equal(true);
                        store.downloadUrl(url).then(function (data) {
                            expect(data).to.equal("foo");
                            done();
                        }).catch(function (e) { return done(new Error(e)); });
                    }).catch(function (e) { return done(new Error(e)); });
                }).catch(function (e) { return done(new Error(e)); });
            });
        });
    });
});
//# sourceMappingURL=dropbox.spec.js.map