(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "chai"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var chai = require("chai");
    var expect = chai.expect;
    function isArray(v) {
        return Object.prototype.toString.call(v) === "[object Array]";
    }
    function compareObjects(obj1, obj2, includeS, path) {
        for (var key in obj1) {
            if (!includeS && (key === "_s"))
                continue;
            if (obj1.hasOwnProperty(key)) {
                var testing = (path || "") + "[" + key + "]";
                expect(typeof obj1[key]).to.equal(typeof obj2[key]);
                if (typeof obj1[key] === "object") {
                    expect(isArray(obj1[key])).to.equal(isArray(obj2[key]));
                    compareObjects(obj1[key], obj2[key], includeS, testing);
                }
                else {
                    expect(obj1[key]).to.equal(obj2[key]);
                }
            }
        }
    }
    exports.compareObjects = compareObjects;
    function getData(s) {
        return s.data;
    }
    exports.getData = getData;
});
//# sourceMappingURL=test-utils.js.map