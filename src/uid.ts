/**
 * Unique ID generator
 */

import {padStr} from "./types";
import * as base64 from "./base64";

interface LastUid {
    at: number;
    uids: Array<number>;
}

let lastUid: LastUid = { at: null, uids: [] };

/**
 * Returns a character string which is locally unique
 * It is based on the current date/time and Math.random
 * @returns string 8 characters, base64 = 48 bits
 */
function create(): string {
    // base64.encodeFloat needs a 48 bit number to get 8 chars
    while (true) {
        // seconds = 32 bits (until 2038), 33 bits afterwards
        // Seconds ensures low risk of collisions across time.
        let seconds: number = Math.floor((new Date()).getTime() / 1000);
        if (seconds !== lastUid.at) {
            lastUid = { at: seconds, uids: [] };
        }
        // 15 bits of randomness
        // random ensures low risk of collision inside a seconds
        let random: number =
            Math.floor(Math.random() * Math.pow(2, 32)) &
            (Math.pow(2, 15) - 1);
        // uid = 15 bits of random + 32/33 bits of time
        let uid: number = (random * Math.pow(2, 32)) + seconds;
        // end result is 47/48 bit random number
        // paranoia: keep track of generated id's to avoid collisions
        if (lastUid.uids.indexOf(uid) === -1) {
            lastUid.uids.push(uid);
            return padStr(base64.encodeFloat(uid), 8);
        }
    }
}

/**
 * Add 48 bits of randomness to standard 8 char uid
 * @return {string} 16 character string
 */
function createLong(): string {
    let random = Math.floor(
        (Math.random() * Math.pow(2, 47)) +
        (Math.random() * Math.pow(2, 32))
    );
    return create() + padStr(base64.encodeFloat(random), 8);
}

export {create as next}
export {createLong as nextLong}
