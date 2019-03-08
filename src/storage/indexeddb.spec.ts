import * as chai from "chai";

import * as minisync from "../minisync";
import { compareObjects, getData } from "../test-utils";
import * as storage from "./index";
import { IndexedDBStore } from "./index";

const expect = chai.expect;

// load indexeddb in node environment
// https://github.com/axemclion/IndexedDBShim
// tslint:disable-next-line:no-var-requires
const setGlobalVars = require("indexeddbshim");
(global as any).window = global;
setGlobalVars(null, {
    checkOrigin: false
});

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
            }).catch((e) => done(new Error(e)));
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
                    }).catch((e) => done(new Error(e)));
                };
            }).catch((e) => done(new Error(e)));
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
                    req.onerror = done;
                    req.onsuccess = (e) => {
                        try {
                            expect(typeof e).to.equal("object");
                            expect(typeof e.target).to.equal("object");
                            const res = (e.target as any).result;
                            expect(typeof res).to.equal("object");
                            expect(res.file).to.be.an("object");
                            expect(res.path).to.equal("path");
                            expect(res.name).to.equal("file2");
                            expect(res.file.path[0]).to.equal("path");
                            expect(res.file.fileName).to.equal("file2");
                            expect(res.file.contents).to.equal("bar");
                            done();
                        } catch (err) {
                            done(err);
                        }
                    };
                });
            }).catch((e) => done(new Error(e)));
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
