const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");

const increment = require("../../src/utils/helper").increment;

[
    {
        "object" : {},
        "value" : "hello world",
        "path" : "some.nested",
        "expected" : {
            some : { nested : 1 }
        }
    },
    {
        "object" : {some : { nested : 1 }},
        "value" : "hello world",
        "path" : "some.nested",
        "expected" : {
            some : { nested : 2 }
        }
    }
].forEach(item => {
    describe(`Given I want to set a value '${item.value}' on an object`, () => {
        let result;

        before(() => {
            result = increment(item.object, item.path);
        });

        it("it should have added the value to the object", () => {
            result.should.be.deep.eq(item.expected);
        });
    });
});