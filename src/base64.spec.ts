import * as base64 from "./base64";

import * as chai from "chai";
import * as mocha from "mocha";

const expect = chai.expect;

describe("minisync core", () => {

    describe("version", () => {

        it("should generate an initial version", () => {
            const version = base64.nextVersion();
            expect(version.length).to.equal(1);
        });

        it("should be different after incrementing", () => {
            const previous: string[] = [];
            let version = "";
            for (let i = 0; i < 100; i++) {
                version = base64.nextVersion(version);
                // @ts-ignore
                expect(previous.indexOf(version)).to.equal(-1);
                previous.push(version);
            }
        });

        it("should be larger after incrementing", () => {
            let previous = "";
            for (let i = 0; i < 100; i++) {
                const version = base64.nextVersion(previous, 5);
                expect(version > previous).to.equal(true);
                previous = version;
            }
        });

        it("should pad to the right length", () => {
            expect(base64.nextVersion("").length).to.equal(1);
            expect(base64.nextVersion("", 1).length).to.equal(1);
            expect(base64.nextVersion("A", 1).length).to.equal(1);
            expect(base64.nextVersion("AA", 5).length).to.equal(5);
            expect(base64.nextVersion("AA", 100).length).to.equal(100);
        });

        it("should sort correctly after padding", () => {
            const a = base64.nextVersion("a", 5);
            const bb = base64.nextVersion("bb", 5);
            expect(bb > a).to.equal(true);
        });

    });

});
