import * as chai from "chai";
import * as mocha from "mocha";

import * as minisync from "../minisync";
import { compareObjects, getData } from "../test-utils";
import * as storage from "./index";
import { IndexedDBStore, Store } from "./index";

const expect = chai.expect;

describe("minisync storage", () => {

    describe("IndexedDB", () => {

        let store: IndexedDBStore;

        before(() => {
            store = new IndexedDBStore("test");
        });

        beforeEach((done) => {
            // clear database
            store.openDB().then((db) => {
                db.transaction("files", "readwrite").objectStore("files").clear().onsuccess = () => {
                    done();
                };
            });
        });

        function putFile(path: string, file: string, contents: any) {
            return store.openDB().then((db) =>
                db.transaction("files", "readwrite").objectStore("files").put({
                    name: file,
                    path,
                    file: { path: [path], fileName: file, contents }
                }, path + "/" + file)
            );
        }

        it("should load a file", (done) => {
            putFile("path", "file", "foo").then((req) => {
                req.onsuccess = () => {
                    store.getFile({ path: ["path"], fileName: "file"}).then((result) => {
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

        it("should save a file", (done) => {
            store.putFile({
                path: ["path"],
                fileName: "file2",
                contents: "bar"
            }).then((result) => {
                expect(result).to.equal(true);
                store.openDB().then((db) => {
                    const req = db.transaction("files").objectStore("files").get("path/file2");
                    req.onsuccess = (e) => {
                        expect(e).to.be.an("object");
                        expect(e.target).to.be.an("object");
                        const res = (e.target as any).result;
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

        it("should load several files", (done) => {
            Promise.all([
                putFile("path", "file1", "foo"),
                putFile("path", "file2", "foo")
            ]).then((reqs) => {
                reqs[1].onsuccess = () => {
                    const data = [
                        {path: ["path"], fileName: "file1"},
                        {path: ["path"], fileName: "file2"}
                    ];
                    store.getFiles(data).then((result) => {
                        (data[0] as any).contents = (data[1] as any).contents = "foo";
                        expect(typeof result).to.equal("object");
                        expect(result).to.deep.equal(data);
                        done();
                    });
                };
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
