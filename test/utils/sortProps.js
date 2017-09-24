const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");

const sortProps = require("../../src/utils/helper").sortProps;

[
    {
        "object" : undefined,
        "expected" : undefined
    },
    {
        "object" : {
            "a" : 1,
            "c" : {
                "2" : [ 4, 2, 1 ],
                "1" : null
            },
            "b" : undefined
        },
        "expected" : {
            "a" : 1,
            "b" : undefined,
            "c" : {
                "1" : null,
                "2" : [ 4, 2, 1 ],
            }
        }
    },
].forEach(item => {
    describe(`Given I want to set a value on an object`, () => {
        let result;

        before(() => {
            result = sortProps(item.object);
        });

        const stringKeys = (obj) => {
            if (!obj) return [];
            if (typeof obj !== "object") return [];
            if (Array.isArray(obj)) {
                return obj.map(item => sortProps(item));
            }
            let _ = [];
            Object.keys(obj).forEach(key => {
                const children = stringKeys(obj[key]);
                if (Array.isArray(children)){
                    _.push(...children.map(child => `${key}.${child}`));
                } else {
                    _.push(key);
                }
            });
            return _;
        }

        it("it should have added the value to the object", () => {
            stringKeys(result).join(",").should.be.equals(stringKeys(item.expected).join(","));
        });
    });
});