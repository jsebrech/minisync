(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./uid", "chai"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uid = require("./uid");
    var chai = require("chai");
    var expect = chai.expect;
    describe("minisync core", function () {
        describe("uid", function () {
            it("should be unique many times", function () {
                var ids = [];
                var id = null;
                for (var i = 0; i < 1000; i++) {
                    id = uid.next();
                    expect(ids.indexOf(id)).to.equal(-1);
                    ids.push(id);
                }
            });
            it("should be an 8 char string", function () {
                var id = uid.next();
                expect(id.length).to.equal(8);
            });
            it("should also generate a 16 char string", function () {
                var id = uid.nextLong();
                expect(id.length).to.equal(16);
            });
        });
    });
});
//# sourceMappingURL=uid.spec.js.map