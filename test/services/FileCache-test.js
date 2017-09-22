const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const mockFs = require("mock-fs");
const FileCache = require("../../src/services/FileCache").FileCache;

chai.use(require("chai-as-promised"));
chai.should();
const error = new Error("oh no");

const range = {
    from: new Date(),
    to: new Date()
};
const query = "item";

const basePath = process.cwd();
const dataPath = `${basePath}/data`;
const cacheItemDir = `${dataPath}/${range.from.getTime()}-${range.to.getTime()}-${query}`
const fileName = `0`;
const fullFileName = `${cacheItemDir}/${fileName}`;
const fileContent = { "not" : "important" };

let baseDir = {};
baseDir[basePath] = {};
let dataDir = {};
dataDir[dataPath] = {};
let fileInDir = {};
fileInDir[fullFileName] = JSON.stringify(fileContent);

describe("Given I want to use the FileCache", () => {
    let subject = new FileCache();
    let sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        subject = new FileCache();
    });

    afterEach(() => {
        mockFs.restore();
        sandbox.restore();
    })

    describe("And I want to check if a cache item exists", () => {
        let result;
        describe("When it does not exist", () => {
            describe("And the path for the cache does not exist", () => {
                let mkdirSync = sandbox.spy();
                beforeEach(() => {
                    mockFs(baseDir);
                    mkdirSync = sandbox.spy(fs, "mkdirSync");
                    result = subject.has(range, query)
                });

                it("should not have created the path", () => {
                    mkdirSync.calledWith(dataPath).should.be.false;
                    fs.existsSync(dataPath).should.be.false;
                });

                it("should return false", () => {
                    result.should.be.false;
                });

                describe("And I want to create the cache entry", () => {
                    let writeFile = sandbox.spy();

                    beforeEach(() => {
                        writeFile = sandbox.spy(fs, "writeFile");
                        result = subject.set(range, query, 0, fileContent);
                    });

                    it("should write the file", () => {
                        writeFile.getCall(0).args[0].should.be.equals(fullFileName);
                        writeFile.getCall(0).args[1].should.be.equals(JSON.stringify(fileContent));
                        fs.existsSync(fullFileName).should.be.true;
                    });
                });
            });

            describe("But the cache folder already exists", () => {
                let mkdirSync = sandbox.spy();
                beforeEach(() => {
                    mockFs(dataDir);
                    mkdirSync = sandbox.spy(fs, "mkdirSync");
                    result = subject.has(range, query)
                });

                it("should not have created the path again", () => {
                    mkdirSync.called.should.be.false;
                    fs.existsSync(dataPath).should.be.true;
                });

                it("should return false", () => {
                    result.should.be.false;
                });
            });
        });

        describe("When it exists", () => {
            beforeEach(() => {
                mockFs(fileInDir);
                result = subject.has(range, query)
            });

            it("should return true", () => {
                result.should.be.true;
            });
        })
    });

    describe("And I want to retrieve an existing cache entry", () => {
        describe("When the file exists", () => {
            beforeEach(() => {
                mockFs(fileInDir);
                result = subject.get(range, query, 0);
            });

            it("should load the cache item correctly", () => {
                return result.should.become(fileContent);
            });

            describe("And I want to validate the expected number of shards are available", () => {
                it("should validate the cache", () => {
                    subject.validateCache(range, query, 1).should.be.true;
                });
            });

            describe("And I want to validate the expected number of shards are available", () => {
                it("should invalidate the cache", () => {
                    subject.validateCache(range, query, 2).should.be.false;
                });
            })
        });

        describe("When the file does not exist", () => {
            beforeEach(() => {
                mockFs(baseDir);
                result = subject.get(range, query, 0);
            });

            it("should fail", () => {
                return result.should.be.rejected;
            });
        });
    });
});