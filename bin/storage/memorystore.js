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
    var DATA_URI_PREFIX = "data:text/plain;base64,";
    /**
     * Memory-based store mostly useful for testing.
     */
    var MemoryStore = /** @class */ (function () {
        function MemoryStore(files) {
            if (files === void 0) { files = {}; }
            this.files = files;
        }
        MemoryStore.prototype.getFile = function (file) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var stored = _this.valueAtPath([].concat(file.path, [file.fileName]));
                if (stored === null) {
                    reject(new Error("No such file: " + JSON.stringify(file)));
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
        MemoryStore.prototype.putFile = function (file) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var folder = _this.files;
                for (var _i = 0, _a = file.path; _i < _a.length; _i++) {
                    var part = _a[_i];
                    if (!folder[part])
                        folder[part] = {};
                    folder = folder[part];
                }
                folder[file.fileName] = file.contents;
                resolve(true);
            });
        };
        MemoryStore.prototype.listFiles = function (path) {
            var result = [];
            var folder = this.valueAtPath(path);
            if (folder) {
                for (var key in folder) {
                    if (typeof folder[key] !== "object") {
                        result.push({
                            path: path,
                            fileName: key
                        });
                    }
                }
            }
            return Promise.resolve(result);
        };
        MemoryStore.prototype.publishFile = function (file) {
            return this.getFile(file).then(function (data) {
                return DATA_URI_PREFIX + btoa(data.contents);
            });
        };
        MemoryStore.prototype.canDownloadUrl = function (url) {
            return /^data\:text/.test(url);
        };
        MemoryStore.prototype.downloadUrl = function (url) {
            return Promise.resolve(atob(url.substring(DATA_URI_PREFIX.length)));
        };
        MemoryStore.prototype.valueAtPath = function (path) {
            var result = this.files;
            for (var _i = 0, path_1 = path; _i < path_1.length; _i++) {
                var part = path_1[_i];
                result = result[part];
            }
            return result;
        };
        return MemoryStore;
    }());
    exports.MemoryStore = MemoryStore;
});
//# sourceMappingURL=memorystore.js.map