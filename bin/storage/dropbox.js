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
    var DropboxStore = /** @class */ (function () {
        /**
         * Instantiate a dropbox-backed store
         * @param dropbox An instance of the Dropbox Javascript SDK's Dropbox class
         * @param rootFolder The root folder inside of which all paths for store operations are located.
         * @param response A handle to the Response class (for nodejs environments)
         */
        function DropboxStore(dropbox, rootFolder, response) {
            if (rootFolder === void 0) { rootFolder = "minisync"; }
            this.dropbox = dropbox;
            this.rootFolder = rootFolder;
            this.response = response;
        }
        DropboxStore.prototype.putFile = function (file) {
            return this.dropbox.filesUpload({
                path: this.pathToString(file.path) + file.fileName,
                contents: file.contents,
                mode: { ".tag": "overwrite" }
            }).then(function (s) { return true; });
        };
        DropboxStore.prototype.getFile = function (file) {
            var _this = this;
            return this.dropbox.filesDownload({
                path: this.pathToString(file.path) + file.fileName
            }).then(function (f) {
                // in node it returns a fileBinary
                if (f.fileBinary) {
                    return f.fileBinary;
                    // in browser it returns a fileBlob
                }
                else if (f.fileBlob) {
                    var responseImpl = _this.response || Response;
                    return (new responseImpl(f.fileBlob)).text();
                }
                else {
                    throw new Error("no fileBinary or fileBlob in response");
                }
            }).then(function (t) {
                return {
                    path: file.path,
                    fileName: file.fileName,
                    contents: t
                };
            });
        };
        DropboxStore.prototype.listFiles = function (path) {
            var _this = this;
            var handle = function (res, list) {
                if (res.has_more) {
                    return _this.dropbox.filesListFolderContinue({ cursor: res.cursor }).then(handle);
                }
                else {
                    return Promise.resolve([].concat(res.entries.filter(function (f) { return f[".tag"] === "file"; }), list));
                }
            };
            return this.dropbox.filesListFolder({ path: this.pathToString(path) })
                .then(handle)
                .then(function (files) {
                return files.map(function (f) { return ({ path: path, fileName: f.name }); });
            });
        };
        /**
         * Convert ["some", "path"] to "/<rootFolder>/some/path/"
         * @param path Array to convert
         */
        DropboxStore.prototype.pathToString = function (path) {
            return [].concat(["", this.rootFolder], path, [""]).join("/").replace(/(\/)+/g, "/");
        };
        return DropboxStore;
    }());
    exports.DropboxStore = DropboxStore;
});
//# sourceMappingURL=dropbox.js.map