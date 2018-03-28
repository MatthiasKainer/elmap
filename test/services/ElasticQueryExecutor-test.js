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
        client,
        result;

    beforeEach(() => {
        sandbox.reset();
        client = sandbox.stub();
        const clientWrapper = function() {
            this.search = client;
            return this;
        };
        elastic.ClientWrapper = clientWrapper;
    });

    afterEach(() => sandbox.restore());

    describe("And request fails", () => {
        beforeEach(() => {
            client.yields(error);
            result = new elastic.NativeElasticQueryExecutor()
                .execute("http://elastic.co", {});
        });

        it("should reject with the correct error", () => {
            return result.should.be.rejectedWith(error);
        });
    });

    describe("And request succeeds and is a json", () => {
        const serverResponse = { hits : { hits: [], total : 0} };
        beforeEach(() => {
            client.yields(null, serverResponse);
            result = new elastic.NativeElasticQueryExecutor()
                .execute("http://elastic.co", {}, () => {});
        });

        it("should return the correct body", () => {
            return result.should.eventually.become(serverResponse);
        });
    });
});