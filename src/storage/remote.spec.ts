import * as chai from "chai";
import { MemoryStore } from "./memorystore";
import { getClientIndex, getMasterIndex } from "./remote";

const expect = chai.expect;

describe("minisync storage", () => {
    describe("remote sync", () => {

        let store: MemoryStore;

        beforeEach(() => {
            store = new MemoryStore({ 
                "documents": {
                    "document-ABC": {
                        "master-index.json": JSON.stringify({
                            _minisync: {
                                dataType: "MASTER-INDEX"
                            }
                        }),
                        "client-FOO": {
                            "client-index.json": JSON.stringify({
                                _minisync: {
                                    dataType: "CLIENT-INDEX"
                                }
                            })
                        }
                    }
                }
            })
        });

        it("getClientIndex returns the right file", (done) => {
            getClientIndex("ABC", "FOO", store).then((index) => {
                expect(index).to.be.an("object");
                done();
            });
        });

        it("getMasterIndex returns the right file", (done) => {
            getMasterIndex("ABC", store).then((index) => {
                expect(index).to.be.an("object");
                done();
            });
        });
    });
});
