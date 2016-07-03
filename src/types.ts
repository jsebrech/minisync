export type TODO = any;

/**
 * Returns true if the given parameter is an Array
 * @param v
 * @returns {boolean}
 */
export function isArray(v: any): boolean {
    return Object.prototype.toString.call(v) === "[object Array]";
};

/**
 * Return a date string which can be compared using < and >
 * @param {Date} [date]
 * @returns {String}
 */
export function dateToString(date: Date): string {
    if (!(date instanceof Date)) date = new Date();
    return padStr(date.getUTCFullYear().toString(), 4) +
           padStr((date.getUTCMonth() + 1).toString(), 2) +
           padStr(date.getUTCDate().toString(), 2) +
           padStr(date.getUTCHours().toString(), 2) +
           padStr(date.getUTCMinutes().toString(), 2) +
           padStr(date.getUTCSeconds().toString(), 2);
};

/**
 * Left-pad a string to the desired length with zeroes
 * @param arg
 * @param {int} length
 * @returns {string}
 */
export function padStr(arg: string, length: number): string {
    let str: string = String(arg);
    while (str.length < length) str = "0" + str;
    return str;
}
