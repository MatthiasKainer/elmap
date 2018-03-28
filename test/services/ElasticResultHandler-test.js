const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");
const elastic = require("../../src/services/ElasticQueryable");
const FileCache = require("../../src/services/FileCache");
const mockFs = require("mock-fs");

chai.use(require("chai-as-promised"));
chai.should();
const error = new Error("oh no");
const range = {
    from: new Date(),
    to: new Date()
};

describe("Given I want to get results from an ElasticQueryExecutor", () => {
    let sandbox = sinon.sandbox.create();
    let fakeRequest = sandbox.stub();
    let result = new Promise((resolve, reject) => resolve());
    const request = new elastic.NativeElasticQueryExecutor();
    const subject = new elastic.ElasticResultHandler(request);

    beforeEach(() => {
        mockFs(`${process.cwd()}/data`);
        sandbox = sinon.sandbox.create();
        fakeRequest = sandbox.stub(request, "execute");
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("and the server responds with an error", () => {

        beforeEach(() => {
            fakeRequest.rejects(error);
            result = subject.start("url", range);
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
            result = subject.start("url", range);
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
            result = subject.start("url", range);
        });

        it("should return a valid result", () => {
            return result.should.eventually.deep.equal(singlePageResult);
        });

        it("should have requested a result page only once", () => {
            fakeRequest.calledOnce.should.be.true;
        });
    });

    describe("and the server responds with a set containing two pages", () => {
        describe("and the second fails", () => {
            beforeEach(() => {
                fakeRequest.onFirstCall().resolves(firstPageResult);
                fakeRequest.onSecondCall().rejects(error);
                result = subject.start("url", range);
            });

            it("should return an error", () => {
                return result.should.be.rejected;
            })

            it("should reject with the correct error", () => {
                return result.should.be.rejectedWith(error);
            })
        });

        describe("and both are successful", () => {
            let writeFile;

            beforeEach(() => {
                fakeRequest.onFirstCall().resolves(firstPageResult);
                fakeRequest.onSecondCall().resolves(secondPageResult);
                fakeRequest.onThirdCall().rejects(error);
                writeFile = sandbox.spy(FileCache.FileCache.prototype, "set");
                result = subject.start("url", range);
            });

            it("should return a combined result", () => {
                const combined = { hits: { total: firstPageResult.hits.total, hits: [...firstPageResult.hits.hits, ...secondPageResult.hits.hits] } };
                return result.should.eventually.deep.equal(combined);
            });

            it("should have asked for existing cache items twice", () => {
                setImmediate(() => {
                    hasFile.callCount.should.be.equal(2);
                });
            });

            it("should have requested a result page exactly twice", () => {
                return result.should.not.be.rejected;
            });

            it("should have written to cache twice", () => {
                setImmediate(() => {
                    writeFile.callCount.should.be.equal(2);
                });
            });
        });

    });

    describe("And one of the results is in the cache, while the other one doesn't", () => {
        let writeFile, hasFile, getFile;

        beforeEach(() => {
            fakeRequest.onFirstCall().resolves(firstPageResult)
                .onSecondCall().rejects(error);
            hasFile = sandbox.stub(FileCache.FileCache.prototype, "has");
            hasFile.onFirstCall().returns(false).onSecondCall().returns(true);

            getFile = sandbox.stub(FileCache.FileCache.prototype, "get")
                .onFirstCall().resolves(secondPageResult)
                .onSecondCall().rejects(error);
            writeFile = sandbox.spy(FileCache.FileCache.prototype, "set");
            result = subject.start("url", range);
        });

        it("should return a combined result", () => {
            const combined = { hits: { total: firstPageResult.hits.total, hits: [...firstPageResult.hits.hits, ...secondPageResult.hits.hits] } };
            return result.should.eventually.deep.equal(combined);
        });

        it("should have requested a result page only once", () => {
            return result.should.not.be.rejected;
        });

        it("should have asked for existing cache items twice", () => {
            setImmediate(() => {
                hasFile.callCount.should.be.equal(2);
            });
        });

        it("should have loaded a file from cache once", () => {
            setImmediate(() => {
                getFile.callCount.should.be.equal(1);
            });
        });

        it("should have written to cache once", () => {
            setImmediate(() => {
                writeFile.callCount.should.be.equal(1);
            });
        });
    });

    afterEach(() => {
        sandbox.restore();
    });
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