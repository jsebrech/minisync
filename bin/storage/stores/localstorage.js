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
    var LocalStorageStore = /** @class */ (function () {
        function LocalStorageStore(prefix) {
            if (prefix === void 0) { prefix = "minisync"; }
            this.prefix = prefix;
        }
        LocalStorageStore.prototype.getFile = function (file) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var stored = window.localStorage.getItem(_this.prefix + "//" + _this.encode(file));
                if (stored === null) {
                    resolve(null);
                }
                else {
                    resolve({
                        path: file.path,
                        fileName: file.fileName,
                        contents: stored
                    });
                }
            });
        };
        LocalStorageStore.prototype.putFile = function (file) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                window.localStorage.setItem(_this.prefix + "//" + _this.encode(file), file.contents);
                resolve({
                    path: file.path,
                    fileName: file.fileName
                });
            });
        };
        LocalStorageStore.prototype.listFiles = function (path) {
            var internalPath = this.prefix + "//" + path.join("/") + "/";
            return Promise.resolve(this.allKeys().filter(function (key) {
                return key.indexOf(internalPath) === 0;
            }).map(function (key) {
                return {
                    path: path,
                    fileName: key.substr(internalPath.length)
                };
            }));
        };
        LocalStorageStore.prototype.allKeys = function () {
            var result = [];
            for (var i = 0, len = localStorage.length; i < len; ++i) {
                result.push(localStorage.key(i));
            }
            return result;
        };
        LocalStorageStore.prototype.encode = function (what) {
            if (typeof what === "object") {
                return this.encode(what.path.join("/") + "/" + what.fileName);
            }
            else
                return what;
        };
        return LocalStorageStore;
    }());
    exports.LocalStorageStore = LocalStorageStore;
});
//# sourceMappingURL=localstorage.js.map