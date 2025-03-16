import * as uid from "./uid";

import * as chai from "chai";
import * as mocha from "mocha";

const expect = chai.expect;

describe("uid", () => {

    it("should be unique many times", () => {
        const ids: string[] = [];
        let id: string;
        for (let i = 0; i < 1000; i++) {
            id = uid.next();
            expect(ids.indexOf(id)).to.equal(-1);
            ids.push(id);
        }
    });

    it("should be an 8 char string", () => {
        const id = uid.next();
        expect(id.length).to.equal(8);
    });

    it("should also generate a 16 char string", () => {
        const id = uid.nextLong();
        expect(id.length).to.equal(16);
    });

});
