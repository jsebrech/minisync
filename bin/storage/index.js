(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./local", "./remote", "./stores/localstorage", "./stores/indexeddb", "./stores/dropbox", "./stores/memorystore"], factory);
    }
})(function (require, exports) {
    "use strict";
    function __export(m) {
        for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    // syncing to device-local stores
    __export(require("./local"));
    // syncing to remote stores
    __export(require("./remote"));
    // stores
    __export(require("./stores/localstorage"));
    __export(require("./stores/indexeddb"));
    __export(require("./stores/dropbox"));
    __export(require("./stores/memorystore"));
});
//# sourceMappingURL=index.js.map