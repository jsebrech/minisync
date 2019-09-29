var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
            var _this = this;
            return this.dropbox.filesUpload({
                path: this.pathToString(file.path) + file.fileName,
                contents: file.contents,
                mode: { ".tag": "overwrite" }
            }).then(function (s) { return __awaiter(_this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = {
                                path: file.path,
                                fileName: file.fileName
                            };
                            return [4 /*yield*/, this.publishFile(file)];
                        case 1: return [2 /*return*/, (_a.url = _b.sent(),
                                _a)];
                    }
                });
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
        /** Detects whether the given URL can be downloaded by this store */
        DropboxStore.prototype.canDownloadUrl = function (url) {
            if (/^https:\/\/www\.dropbox\.com/.test(url)) {
                return this.dropbox.sharingGetSharedLinkMetadata({ url: url }).then(function (res) {
                    return !!res;
                }).catch(function (e) { return false; });
            }
            else
                return Promise.resolve(false);
        };
        /** Downloads the given URL and returns the enclosed data */
        DropboxStore.prototype.downloadUrl = function (url) {
            var _this = this;
            return this.dropbox.sharingGetSharedLinkFile({ url: url }).then(function (res) {
                return _this.dataFromFileMeta(res);
            });
        };
        /** Create a public URL for a file */
        DropboxStore.prototype.publishFile = function (file) {
            return this.dropbox.sharingCreateSharedLink({
                path: this.pathToString(file.path) + file.fileName
            }).then(function (meta) { return meta.url; });
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