(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./base64", "chai"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var base64 = require("./base64");
    var chai = require("chai");
    var expect = chai.expect;
    describe("minisync core", function () {
        describe("version", function () {
            it("should generate an initial version", function () {
                var version = base64.nextVersion();
                expect(version.length).to.equal(1);
            });
            it("should be different after incrementing", function () {
                var previous = [];
                var version = "";
                for (var i = 0; i < 100; i++) {
                    version = base64.nextVersion(version);
                    // @ts-ignore
                    expect(previous.indexOf(version)).to.equal(-1);
                    previous.push(version);
                }
            });
            it("should be larger after incrementing", function () {
                var previous = "";
                for (var i = 0; i < 100; i++) {
                    var version = base64.nextVersion(previous, 5);
                    expect(version > previous).to.equal(true);
                    previous = version;
                }
            });
            it("should pad to the right length", function () {
                expect(base64.nextVersion("").length).to.equal(1);
                expect(base64.nextVersion("", 1).length).to.equal(1);
                expect(base64.nextVersion("A", 1).length).to.equal(1);
                expect(base64.nextVersion("AA", 5).length).to.equal(5);
                expect(base64.nextVersion("AA", 100).length).to.equal(100);
            });
            it("should sort correctly after padding", function () {
                var a = base64.nextVersion("a", 5);
                var bb = base64.nextVersion("bb", 5);
                expect(bb > a).to.equal(true);
            });
        });
    });
});
//# sourceMappingURL=base64.spec.js.map