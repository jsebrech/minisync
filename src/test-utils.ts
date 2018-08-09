import * as chai from "chai";
import { Syncable } from "./syncable";

const expect = chai.expect;

function isArray(v: any) {
    return Object.prototype.toString.call(v) === "[object Array]";
}

export function compareObjects(obj1: any, obj2: any, includeS?: boolean, path?: string) {
    for (const key in obj1) {
        if (!includeS && (key === "_s")) continue;
        if (obj1.hasOwnProperty(key)) {
            const testing = (path || "") + "[" + key + "]";
            expect(typeof obj1[key]).to.equal(typeof obj2[key]);
            if (typeof obj1[key] === "object") {
                expect(isArray(obj1[key])).to.equal(isArray(obj2[key]));
                compareObjects(obj1[key], obj2[key], includeS, testing);
            } else {
                expect(obj1[key]).to.equal(obj2[key]);
            }
        }
    }
}

export function getData(s: Syncable) {
    return (s as any).data;
}
