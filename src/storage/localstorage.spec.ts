import * as chai from "chai";
import * as mocha from "mocha";

import * as minisync from "../minisync";
import { compareObjects, getData } from "../test-utils";
import * as storage from "./index";
import { Store } from "./index";

// load localstorage shim
// tslint:disable-next-line:no-var-requires
require("localstorage-polyfill");

const expect = chai.expect;

describe("minisync storage", () => {

    describe("localStorage", () => {

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
                expect(typeof result.path).to.equal("object");
                expect(result.path[0]).to.equal("path");
                expect(result.fileName).to.equal("file");
                expect(result.contents).to.equal("foo");
                done();
            }).catch((e) => done(new Error(e)));
        });

        it("should save a file", (done) => {
            store.putFile({
                path: ["path"],
                fileName: "file2",
                contents: "bar"
            }).then((result) => {
                expect(result).to.equal(true);
                expect(window.localStorage.getItem("test//path/file2")).to.equal("bar");
                done();
            }).catch((e) => done(new Error(e)));
        });

        it("should save and restore a document", (done) => {
            const original = minisync.from({v: [1, 2, {foo: "bar"}, 4, 5]});
            storage.saveLocal(original, store).then((documentID) => {
                return storage.restoreLocal(documentID, store);
            }).then((restored) => {
                compareObjects(getData(original), getData(restored));
                expect(original.getClientID()).to.equal(restored.getClientID());
                done();
            }).catch((e) => done(new Error(e)));
        });
    });

});
