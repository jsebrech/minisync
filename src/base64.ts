import {padStr, Version} from "./types";

/**
 * Base 64 encode/decode (6 bits per character)
 * (not MIME compatible)
 */

// characters are in ascii string sorting order
const base64chars: string =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ^_abcdefghijklmnopqrstuvwxyz";

/**
 * Convert the integer portion of a Number to a base64 string
 * @param num
 * @returns string
 */
function floatToBase64(num: number): string {
    let ret: string = "";
    num = Math.floor(num);
    while (num) {
        const chr = num - (Math.floor(num / 64) * 64);
        ret = base64chars[chr] + ret;
        num = Math.floor(num / 64);
    }
    return ret;
}

/**
 * Increments a base64 version string
 * @param v
 * @param minLength pad version strings to this length
 * When padding the version strings so they are the same length
 * the new version is always greater than the previous when compared with
 * the standard > operator.
 * @returns {string}
 */
function nextVersion(v: Version = "", minLength: number = 1): Version {
    // handles initial version case
    // as well as padding to the appropriate length
    while (v.length < minLength) {
        v = base64chars[0] + v;
    }
    let carry: boolean = false;
    // increment the version string
    // by incrementing from right to left and carrying the overflow
    for (let i = v.length - 1; i >= 0; i--) {
        let pos: number = base64chars.indexOf(v[i]) + 1;
        carry = (pos >= base64chars.length);
        if (carry) pos -= base64chars.length;
        v = v.substr(0, i) + base64chars[pos] + v.substr(i + 1);
        if (!carry) break;
    }
    if (carry) v = base64chars[1] + v;
    return v;
}

/**
 * Returns true if the first parameter is a newer version than the old
 * @param vNew
 * @param vOld
 */
function isNewerVersion(vNew: Version, vOld: Version): boolean {
    if (!vNew) {
        return false;
    } else if (vNew && !vOld) {
        return true;
    } else if (vNew.length === vOld.length) {
        return vNew > vOld;
    } else if (vNew.length > vOld.length) {
        return isNewerVersion(vNew, padStr(vOld, vNew.length));
    } else return false;
}

export {floatToBase64 as encodeFloat};
export {nextVersion, isNewerVersion};
