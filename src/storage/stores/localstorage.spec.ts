import * as chai from "chai";
import * as mocha from "mocha";

import * as minisync from "../../minisync";
import { compareObjects, getData } from "../../test-utils";
import * as storage from "../index";
import { Store } from "../types";

// load localstorage shim
require("localstorage-polyfill");

const expect = chai.expect;

describe("storage - LocalStorage", () => {

    let store: Store;

    before(() => {
        store = new storage.LocalStorageStore("test");
    });

    beforeEach(() => {
        window.localStorage.clear();
    });

    it("should load a file", (done) => {
        window.localStorage.setItem("test//path/file", "foo");
        store.getFile({ path: ["path"], fileName: "file"}).then((result) => {
            expect(typeof result).to.equal("object");
            expect(typeof result?.path).to.equal("object");
            expect(result?.path[0]).to.equal("path");
            expect(result?.fileName).to.equal("file");
            expect(result?.contents).to.equal("foo");
            done();
        }).catch((e) => done(new Error(e)));
    });

    it("should provide an error when loading an non-existent file", (done) => {
        store.getFile({ path: ["no-such-path"], fileName: "no-such-file"}).then((result) => {
            expect(result).to.be.a("null");
            done();
        }).catch((e) => done(e instanceof Error ? e : new Error(JSON.stringify(e))));
    });

    it("should save a file", (done) => {
        store.putFile({
            path: ["path"],
            fileName: "file2",
            contents: "bar"
        }).then((result) => {
            expect(result).to.be.an("object");
            expect(window.localStorage.getItem("test//path/file2")).to.equal("bar");
            done();
        }).catch((e) => done(new Error(e)));
    });

    it("should save and restore a document", (done) => {
        const original = minisync.from({v: [1, 2, {foo: "bar"}, 4, 5]});
        const sync = new storage.LocalSync(store);
        sync.saveLocal(original).then((documentID) => {
            return sync.restoreLocal(documentID);
        }).then((restored) => {
            compareObjects(getData(original), getData(restored));
            expect(original.getClientID()).to.equal(restored.getClientID());
            done();
        }).catch((e) => done(new Error(e)));
    });
});
