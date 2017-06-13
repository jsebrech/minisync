/**
 * Unique ID generator
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./base64", "./types"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var base64 = require("./base64");
    var types_1 = require("./types");
    var lastUid = { at: null, uids: [] };
    /**
     * Returns a character string which is locally unique
     * It is based on the current date/time and Math.random
     * @returns string 8 characters, base64 = 48 bits
     */
    function create() {
        // base64.encodeFloat needs a 48 bit number to get 8 chars
        while (true) {
            // seconds = 32 bits (until 2038), 33 bits afterwards
            // Seconds ensures low risk of collisions across time.
            var seconds = Math.floor((new Date()).getTime() / 1000);
            if (seconds !== lastUid.at) {
                lastUid = { at: seconds, uids: [] };
            }
            // 15 bits of randomness
            // random ensures low risk of collision inside a seconds
            var random = 
            // tslint:disable-next-line:no-bitwise
            Math.floor(Math.random() * Math.pow(2, 32)) &
                (Math.pow(2, 15) - 1);
            // uid = 15 bits of random + 32/33 bits of time
            var uid = (random * Math.pow(2, 32)) + seconds;
            // end result is 47/48 bit random number
            // paranoia: keep track of generated id's to avoid collisions
            if (lastUid.uids.indexOf(uid) === -1) {
                lastUid.uids.push(uid);
                return types_1.padStr(base64.encodeFloat(uid), 8);
            }
        }
    }
    exports.next = create;
    /**
     * Add 48 bits of randomness to standard 8 char uid
     * @return {string} 16 character string
     */
    function createLong() {
        var random = Math.floor((Math.random() * Math.pow(2, 47)) +
            (Math.random() * Math.pow(2, 32)));
        return create() + types_1.padStr(base64.encodeFloat(random), 8);
    }
    exports.nextLong = createLong;
});
//# sourceMappingURL=uid.js.map