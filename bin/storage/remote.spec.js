(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "chai", "./memorystore", "./remote"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var chai = require("chai");
    var memorystore_1 = require("./memorystore");
    var remote_1 = require("./remote");
    var expect = chai.expect;
    describe("minisync storage", function () {
        describe("remote sync", function () {
            var store;
            beforeEach(function () {
                store = new memorystore_1.MemoryStore({
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
                });
            });
            it("getClientIndex returns the right file", function (done) {
                remote_1.getClientIndex("ABC", "FOO", store).then(function (index) {
                    expect(index).to.be.an("object");
                    done();
                });
            });
            it("getMasterIndex returns the right file", function (done) {
                remote_1.getMasterIndex("ABC", store).then(function (index) {
                    expect(index).to.be.an("object");
                    done();
                });
            });
        });
    });
});
//# sourceMappingURL=remote.spec.js.map