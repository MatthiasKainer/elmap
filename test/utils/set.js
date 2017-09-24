const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");

const set = require("../../src/utils/helper").set;

[
    {
        "object" : {},
        "value" : "hello world",
        "path" : "some.nested",
        "expected" : {
            some : { nested : "hello world" }
        }
    },
    {
        "object" : {some : { nested : "default" }},
        "value" : "hello world",
        "path" : "some.nested",
        "expected" : {
            some : { nested : "hello world" }
        }
    }
].forEach(item => {
    describe(`Given I want to set a value on an object ${item}`, () => {
        let result;

        before(() => {
            result = set(item.object, item.path, item.value);
        });

        it("should have set the field in the object", () => {
            result.should.be.deep.eq(item.expected);
        });
    });
});