const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");

const push = require("../../src/utils/helper").push;

[
    {
        "object" : {},
        "value" : "hello world",
        "path" : "some.nested",
        "expected" : {
            some : { nested : ["hello world"] }
        }
    },
    {
        "object" : {some : { nested : ["default"] }},
        "value" : "hello world",
        "path" : "some.nested",
        "expected" : {
            some : { nested : ["default", "hello world"] }
        }
    }
].forEach(item => {
    describe(`Given I want to set a value '${item.value}' on an object`, () => {
        let result;

        before(() => {
            result = push(item.object, item.path, `${item.value}`);
        });

        it("it should have added the value to the object", () => {
            result.should.be.deep.eq(item.expected);
        });
    });
});