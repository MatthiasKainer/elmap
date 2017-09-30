const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");
const request = require("request");
const elastic = require("../../src/services/ElasticQueryable");

chai.use(require("chai-as-promised"));
chai.should();
const error = new Error("oh no");

describe("Given I call the ElasticQueryExecutor", () => {
    let sandbox = sinon.sandbox.create(),
        get,
        result;

    beforeEach(() => {
        sandbox.reset();
        get = sandbox.stub();
        elastic.requestWrapper = get;
    });

    afterEach(() => sandbox.restore());

    describe("And request fails", () => {
        beforeEach(() => {
            get.yields(error);
            result = new elastic.ElasticQueryExecutor()
                .execute("http://elastic.co", {});
        });

        it("should reject with the correct error", () => {
            return result.should.be.rejectedWith(error);
        });
    });

    describe("And the server answers with an error", () => {
        beforeEach(() => {
            get.yields(null, { statusCode: 500, body: { error: error.message } });
            result = new elastic.ElasticQueryExecutor()
                .execute("http://elastic.co", {});
        });

        it("should reject with the correct error", () => {
            return result.should.be.rejected;
        });
    });

    describe("And request succeeds and is a json", () => {
        beforeEach(() => {
            get.yields(null, { statusCode: 200, body: { hits : {} } });
            result = new elastic.ElasticQueryExecutor()
                .execute("http://elastic.co", {});
        });

        it("should return the correct body", () => {
            return result.should.eventually.become({ hits : {} });
        });
    });
});