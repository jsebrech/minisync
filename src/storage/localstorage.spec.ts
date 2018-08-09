import * as chai from "chai";
import * as mocha from "mocha";

import * as minisync from "../minisync";
import { compareObjects, getData } from "../test-utils";
import * as storage from "./index";
import { Store } from "./index";

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
                expect(result).to.be.an("object");
                expect(result.path).to.be.an("object");
                expect(result.path[0]).to.equal("path");
                expect(result.fileName).to.equal("file");
                expect(result.contents).to.equal("foo");
                done();
            });
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
            });
        });

        it("should load several files", (done) => {
            window.localStorage.setItem("test//path/file1", "foo");
            window.localStorage.setItem("test//path/file2", "foo");
            const data: any = [
                {path: ["path"], fileName: "file1"},
                {path: ["path"], fileName: "file2"}
            ];
            store.getFiles(data).then((result) => {
                data[0].contents = data[1].contents = "foo";
                expect(result).to.be.an("object");
                expect(result).to.equal(data);
                done();
            });
        });

        it("should save and restore a document", (done) => {
            const original = minisync.from({v: [1, 2, {foo: "bar"}, 4, 5]});
            storage.save(original, store).then((documentID) => {
                return storage.restore(documentID, store);
            }).then((restored) => {
                compareObjects(getData(original), getData(restored));
                expect(original.getClientID()).to.equal(restored.getClientID());
                done();
            }).catch((reason) => {
                done(new Error(reason));
            });
        });
    });

});
