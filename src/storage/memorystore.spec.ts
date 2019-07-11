import * as chai from "chai";
import * as storage from "./index";
import { MemoryStore } from "./index";

const expect = chai.expect;

describe("minisync storage", () => {
    describe("MemoryStore", () => {
        let store: MemoryStore;

        beforeEach(() => {
            store = new storage.MemoryStore({
                path1: {
                    file1: "foo",
                    file2: "bar"
                }
            });
        });

        it("should store and load a file", (done) => {
            store.putFile({
                path: ["path2"],
                fileName: "file",
                contents: "foo"
            }).then((result) => {
                expect(result).to.equal(true);
                store.getFile({ path: ["path2"], fileName: "file"}).then((result) => {
                    expect(typeof result).to.equal("object");
                    expect(typeof result.path).to.equal("object");
                    expect(result.path[0]).to.equal("path2");
                    expect(result.fileName).to.equal("file");
                    expect(result.contents).to.equal("foo");
                    done();
                }).catch((e) => done(new Error(e)));
            }).catch((e) => done(new Error(e)));
        });

        it("should provide an error when loading an non-existent file", (done) => {
            store.getFile({ path: ["no-such-path"], fileName: "no-such-file"}).then((result) => {
                expect(result).to.be.a("null");
                done();
            }).catch((e) => done(e instanceof Error ? e : new Error(JSON.stringify(e))));
        });

        it("should list files in a folder", (done) => {
            store.listFiles(["path1"]).then((result) => {
                expect(result.length).to.equal(2);
                expect(result[0].fileName).to.equal("file1");
                expect(result[1].fileName).to.equal("file2");
                done();
            }).catch((e) => done(new Error(e)));
        });
    });
});
