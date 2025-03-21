import * as chai from "chai";
import { fetch, Response } from "cross-fetch";
import { Dropbox, DropboxResponse, files } from "dropbox";

import * as minisync from "../../minisync";
import { compareObjects, getData } from "../../test-utils";
import * as storage from "../index";
import { DropboxStore } from "../index";

import * as dotenv from "dotenv";
dotenv.config();

const expect = chai.expect;

// to test, obtain an access token from dropbox
// see https://www.dropbox.com/developers/reference/oauth-guide
// then put it in a .env file in the project's root (see .env.example)
// and remove ".skip" from the test below
const accessToken = process.env.DROPBOX_ACCESS_TOKEN;

describe.skip("storage - Dropbox", () => {

    let store: DropboxStore;
    let dbx: Dropbox;

    const testRoot = "minisync_test_dbx";

    before(function() {
        this.timeout(10000);
        dbx = new Dropbox({ accessToken, fetch });
        store = new DropboxStore(dbx, testRoot, Response);
        return dbx.filesGetMetadata({ path: "/" + testRoot }).then(() => {
            return dbx.filesDeleteV2({ path: "/" + testRoot });
        }).catch(() => true);
    });

    function putFile(path: string, file: string, contents: any) {
        return dbx.filesUpload({
            path: "/" + testRoot + "/" + path + "/" + file,
            contents,
            mode: { ".tag": "overwrite" }
        });
    }

    it("should load a file", function(done) {
        this.timeout(5000);
        putFile("path", "file", "foo").then(() => {
            store.getFile({ path: ["path"], fileName: "file"}).then((result) => {
                expect(typeof result).to.equal("object");
                expect(typeof result?.path).to.equal("object");
                expect(result?.path[0]).to.equal("path");
                expect(result?.fileName).to.equal("file");
                expect(result?.contents).to.equal("foo");
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

    it("should save a file", function(done) {
        this.timeout(5000);
        store.putFile({
            path: ["path"],
            fileName: "file2",
            contents: "bar"
        }).then((result) => {
            expect(result).to.be.an("object");
            // download file and check contents
            dbx.filesDownload({
                path: "/" + testRoot + "/path/file2"
            }).then((response: DropboxResponse<files.FileMetadata>) => {
                expect(response.result).to.be.an("object");
                const f: any = response.result;
                // in node it returns a fileBinary
                if (f.fileBinary) {
                    return f.fileBinary;
                // in browser it returns a fileBlob
                } else if (f.fileBlob) {
                    return (new Response((f as any).fileBlob as Blob)).text();
                } else {
                    throw new Error("no fileBinary or fileBlob in response");
                }
            }).then((t: string) => {
                expect(t).to.equal("bar");
                done();
            });
        }).catch((e) => done(new Error(e)));
    });

    it("should save and restore a document", function(done) {
        this.timeout(5000);
        const original = minisync.from({v: [1, 2, {foo: "bar"}, 4, 5]});
        const sync = new storage.LocalSync(store);
        sync.saveLocal(original).then((documentID) => {
            return sync.restoreLocal(documentID);
        }).then((restored) => {
            compareObjects(getData(original), getData(restored));
            expect(original.getClientID()).to.equal(restored.getClientID());
            done();
        }).catch((reason) => {
            done(new Error(reason));
        });
    });

    it("should publish and download public files", async function() {
        this.timeout(7000);
        const file = await store.putFile({ path: ["path"], fileName: "file", contents: "foo"});
        const url = file.url;
        expect(typeof url).to.equal("string");
        expect(await store.canDownloadUrl(url)).to.equal(true);
        const data = await store.downloadUrl(url);
        expect(data).to.equal("foo");
    });

});
