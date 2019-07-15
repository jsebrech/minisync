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
            }).then(function (s) { return ({
                path: file.path,
                fileName: file.fileName
            }); });
        };
        DropboxStore.prototype.getFile = function (file) {
            var _this = this;
            return this.dropbox.filesDownload({
                path: this.pathToString(file.path) + file.fileName
            }).then(function (f) {
                return _this.dataFromFileMeta(f);
            }).then(function (t) {
                return {
                    path: file.path,
                    fileName: file.fileName,
                    contents: t
                };
            }).catch(function (err) {
                // not found
                if (err && err.status === 409) {
                    return null;
                }
                else
                    throw err;
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
        /** Create a public URL for a file */
        DropboxStore.prototype.publishFile = function (file) {
            return this.dropbox.sharingCreateSharedLink({
                path: this.pathToString(file.path) + file.fileName
            }).then(function (meta) { return meta.url; });
        };
        /** Detects whether the given URL can be downloaded by this store */
        DropboxStore.prototype.canDownloadUrl = function (url) {
            return /^https:\/\/www\.dropbox\.com/.test(url);
        };
        /** Downloads the given URL and returns the enclosed data */
        DropboxStore.prototype.downloadUrl = function (url) {
            var _this = this;
            return this.dropbox.sharingGetSharedLinkFile({ url: url }).then(function (res) {
                return _this.dataFromFileMeta(res);
            });
        };
        /**
         * Convert ["some", "path"] to "/<rootFolder>/some/path/"
         * @param path Array to convert
         */
        DropboxStore.prototype.pathToString = function (path) {
            return [].concat(["", this.rootFolder], path, [""]).join("/").replace(/(\/)+/g, "/");
        };
        /**
         * Extract the file contents from a dropbox API response
         * @param file The file's metadata
         */
        DropboxStore.prototype.dataFromFileMeta = function (file) {
            // in node it returns a fileBinary
            if (file.fileBinary) {
                return Promise.resolve(file.fileBinary);
                // in browser it returns a fileBlob
            }
            else if (file.fileBlob) {
                var responseImpl = this.response || Response;
                return (new responseImpl(file.fileBlob)).text();
            }
            else {
                return Promise.reject(new Error("no fileBinary or fileBlob in response"));
            }
        };
        return DropboxStore;
    }());
    exports.DropboxStore = DropboxStore;
});
//# sourceMappingURL=dropbox.js.map