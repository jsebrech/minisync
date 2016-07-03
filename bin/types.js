(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    /**
     * Returns true if the given parameter is an Array
     * @param v
     * @returns {boolean}
     */
    function isArray(v) {
        return Object.prototype.toString.call(v) === "[object Array]";
    }
    exports.isArray = isArray;
    ;
    /**
     * Return a date string which can be compared using < and >
     * @param {Date} [date]
     * @returns {String}
     */
    function dateToString(date) {
        if (!(date instanceof Date))
            date = new Date();
        return padStr(date.getUTCFullYear().toString(), 4) +
            padStr((date.getUTCMonth() + 1).toString(), 2) +
            padStr(date.getUTCDate().toString(), 2) +
            padStr(date.getUTCHours().toString(), 2) +
            padStr(date.getUTCMinutes().toString(), 2) +
            padStr(date.getUTCSeconds().toString(), 2);
    }
    exports.dateToString = dateToString;
    ;
    /**
     * Left-pad a string to the desired length with zeroes
     * @param arg
     * @param {int} length
     * @returns {string}
     */
    function padStr(arg, length) {
        var str = String(arg);
        while (str.length < length)
            str = "0" + str;
        return str;
    }
    exports.padStr = padStr;
});
//# sourceMappingURL=types.js.map