(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./types"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var types_1 = require("./types");
    /**
     * Base 64 encode/decode (6 bits per character)
     * (not MIME compatible)
     */
    // characters are in ascii string sorting order
    var base64chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ^_abcdefghijklmnopqrstuvwxyz";
    /**
     * Convert the integer portion of a Number to a base64 string
     * @param num
     * @returns string
     */
    function floatToBase64(num) {
        var ret = "";
        num = Math.floor(num);
        while (num) {
            var chr = num - (Math.floor(num / 64) * 64);
            ret = base64chars[chr] + ret;
            num = Math.floor(num / 64);
        }
        return ret;
    }
    exports.encodeFloat = floatToBase64;
    /**
     * Increments a base64 version string
     * @param v
     * @param minLength pad version strings to this length
     * When padding the version strings so they are the same length
     * the new version is always greater than the previous when compared with
     * the standard > operator.
     * @returns {string}
     */
    function nextVersion(v, minLength) {
        if (v === void 0) { v = ""; }
        if (minLength === void 0) { minLength = 1; }
        // handles initial version case
        // as well as padding to the appropriate length
        while (v.length < minLength) {
            v = base64chars[0] + v;
        }
        var carry = false;
        // increment the version string
        // by incrementing from right to left and carrying the overflow
        for (var i = v.length - 1; i >= 0; i--) {
            var pos = base64chars.indexOf(v[i]) + 1;
            carry = (pos >= base64chars.length);
            if (carry)
                pos -= base64chars.length;
            v = v.substr(0, i) + base64chars[pos] + v.substr(i + 1);
            if (!carry)
                break;
        }
        if (carry)
            v = base64chars[1] + v;
        return v;
    }
    exports.nextVersion = nextVersion;
    /**
     * Returns true if the first parameter is a newer version than the old
     * @param vNew
     * @param vOld
     */
    function isNewerVersion(vNew, vOld) {
        if (!vNew) {
            return false;
        }
        else if (vNew && !vOld) {
            return true;
        }
        else if (vNew.length === vOld.length) {
            return vNew > vOld;
        }
        else if (vNew.length > vOld.length) {
            return isNewerVersion(vNew, types_1.padStr(vOld, vNew.length));
        }
        else
            return false;
    }
    exports.isNewerVersion = isNewerVersion;
});
//# sourceMappingURL=base64.js.map