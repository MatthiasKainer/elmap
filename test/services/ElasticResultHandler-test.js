const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");
const elastic = require("../../src/services/ElasticQueryable");

chai.use(require("chai-as-promised"));
chai.should();
const error = new Error("oh no");

describe("Given I want to get results from an ElasticQueryExecutor", () => {
    let sandbox = sinon.sandbox.create();
    let fakeRequest = sandbox.stub();
    let result = new Promise((resolve, reject) => resolve());
    const request = new elastic.ElasticQueryExecutor();
    const subject = new elastic.ElasticResultHandler(request);

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        fakeRequest = sandbox.stub(request, "execute");
    });

    describe("and the server responds with an error", () => {

        beforeEach(() => {
            fakeRequest.rejects(error);
            result = subject.start("url", {});
        });

        it("should reject the results", () => {
            return result.should.be.rejected;
        })

        it("should reject with the correct error", () => {
            return result.should.be.rejectedWith(error);
        })
    });

    describe("and the server responds with a page without any results", () => {
        beforeEach(() => {
            fakeRequest.resolves(emptyResult);
            result = subject.start("url", {});
        });

        it("should return a valid result", () => {
            return result.should.eventually.deep.equal(emptyResult);
        });

        it("should have requested a result page only once", () => {
            fakeRequest.calledOnce.should.be.true;
        });
    });

    describe("and the server responds with a page containing all results", () => {
        beforeEach(() => {
            fakeRequest.resolves(singlePageResult);
            result = subject.start("url", {});
        });

        it("should return a valid result", () => {
            return result.should.eventually.deep.equal(singlePageResult);
        });

        it("should have requested a result page only once", () => {
            fakeRequest.calledOnce.should.be.true;
        });
    });

    describe("and the server responds with a set containing two pages", () => {
        beforeEach

        describe("and the second fails", () => {
            beforeEach(() => {
                fakeRequest.onFirstCall().resolves(firstPageResult);
                fakeRequest.onSecondCall().rejects(error);
                result = subject.start("url", {});
            });

            it("should return an error", () => {
                return result.should.be.rejected;
            })

            it("should reject with the correct error", () => {
                return result.should.be.rejectedWith(error);
            })
        });

        describe("and both are successful", () => {
            beforeEach(() => {
                fakeRequest.onFirstCall().resolves(firstPageResult);
                fakeRequest.onSecondCall().resolves(secondPageResult);
                fakeRequest.onThirdCall().rejects(error);
                result = subject.start("url", {});
            });

            it("should return a combined result", () => {
                const combined = { hits: { total: firstPageResult.hits.total, hits: [...firstPageResult.hits.hits, ...secondPageResult.hits.hits] } };
                return result.should.eventually.deep.equal(combined);
            });

            it("should have requested a result page exactly twice", () => {
                return result.should.not.be.rejected;
            });
        });

    });

    afterEach(() => {
        sandbox.restore();
    })
});


const emptyResult = {
    "hits": {
        "total": 0,
        "hits": []
    }
};

const singlePageResult = {
    "hits": {
        "total": 1,
        "hits": [
            {
                "_id": "single"
            }
        ]
    }
};

const firstPageResult = {
    "hits": {
        "total": 1001,
        "hits": new Array(1000).map((val, index) => {
            return {
                "_id": index.toString()
            }
        })
    }
};

const secondPageResult = {
    "hits": {
        "total": 1001,
        "hits": [
            {
                "_id": "second"
            }
        ]
    }
}