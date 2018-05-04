const mocha = require("mocha");
const chai = require("chai");
const sinon = require("sinon");
const mockserver = require('mockserver-node');
const mockServerClient = require('mockserver-client').mockServerClient;

const response = require("./response.json");
const elmap = require("../../app").default;
const helpers = require("../../app").helpers;
chai.should();


describe("End to End", function () {
    this.timeout(30000);

    before(() => {
        return mockserver.start_mockserver({
            serverPort: 1080,
            proxyPort: 1090,
            verbose: false
        }).then(() => {
            return mockServerClient("localhost", 1080).mockAnyResponse({
                "httpRequest": {
                    "method": "POST",
                    "path": "/index*/_search"
                },
                "httpResponse": {
                    "statusCode": 200,
                    "body": JSON.stringify(response)
                }
            })
        });
    });

    after(() => {
        mockserver.stop_mockserver();
    });

    it("will create the correct result", () => {
        const transform = (result) => {
            return result.hits.hits.map(hit => {
                const reg = /.*?'(.*?)'.*?'(.*?)'.*?'(.*?)'/;
                const matches = reg.exec(hit.message);
                return {
                    duration : parseInt(hit.callDurationMs),
                    trace : matches[2],
                    instance : matches[3]
                };
            })
            .filter(hit => hit.duration > 50)
            .reduce((hit, current) => {
                const {instance, trace, duration} = current;
                return helpers.push(hit, `${instance}.${trace}`, duration);
            }, {});
        };        

        return elmap({
            url: "http://localhost:1080",
            index: "index*",
            query: "*",
            transform
        }).then(result => {
            result.should.be.deep.eq({
                "instanceid" : {
                    "traceid_1": [
                        128,
                        1024
                    ],
                    "traceid_2": [
                        52
                    ]
                }
            });
        });
    });
});