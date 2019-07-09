(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./core", "./localstorage", "./indexeddb", "./dropbox", "./memorystore"], factory);
    }
})(function (require, exports) {
    "use strict";
    function __export(m) {
        for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    __export(require("./core"));
    __export(require("./localstorage"));
    __export(require("./indexeddb"));
    __export(require("./dropbox"));
    __export(require("./memorystore"));
});
//# sourceMappingURL=index.js.map