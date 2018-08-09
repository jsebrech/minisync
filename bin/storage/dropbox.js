(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var DropboxStore = (function () {
        function DropboxStore() {
        }
        // TODO: write me
        DropboxStore.prototype.putFile = function (file) {
            return null;
        };
        DropboxStore.prototype.getFile = function (file) {
            return null;
        };
        DropboxStore.prototype.getFiles = function (files) {
            return null;
        };
        DropboxStore.prototype.listFiles = function (path) {
            return null;
        };
        return DropboxStore;
    }());
    exports.DropboxStore = DropboxStore;
});
//# sourceMappingURL=dropbox.js.map