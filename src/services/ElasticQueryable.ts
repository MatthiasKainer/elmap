import * as request from 'request';
import * as moment from 'moment';
import { ElasticResult } from "../models/ElasticResult";
import { Queryable } from "./Queryable";
import { DateRange } from "../models/Date";
import { FileCache } from "./FileCache";
var ProgressBar = require('ascii-progress');

export const requestWrapper = request;

export class ElasticQueryExecutor {
    public execute(url: string, json: Object) {
        return new Promise((resolve, reject) => {
            const uri = require("url").parse(url);
            let auth = null;
            if (uri.auth) {
                auth = uri.auth;
                url = url.replace(uri.auth + "@", "");
            }
            requestWrapper({ method: "GET", url, auth, json }, (err, result) => {
                if (err || result.statusCode > 399) return reject(err || new Error(result.body.error));
                else resolve((!result.body.hits ? JSON.parse(result.body) : result.body));
            });
        });
    }
}

class ElasticQueryItem {
    private body: Object;
    private size = process.env.ELMAP_QUERYBATCH || 1000;
    query: string;
    range: DateRange;

    public constructor(query, range) {
        this.query = query;
        this.range = range;
    }

    public getSize() {
        return this.size;
    }

    public getBody(from: number) {
        return {
            "query": {
                "filtered": {
                    "query": {
                        "query_string": {
                            "query": this.query,
                            "analyze_wildcard": true
                        }
                    },
                    "filter": {
                        "bool": {
                            "must": [
                                {
                                    "range": {
                                        "@timestamp": {
                                            "gte": this.range.from,
                                            "lte": this.range.to
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            "from": from,
            "size": this.size,
            "fields": [
                "*",
                "_source"
            ],
            "script_fields": {},
            "fielddata_fields": [
                "timestamp",
                "@timestamp"
            ]
        };
    }
}

class ProgressBarWrapper {
    bar;
    constructor(total: number) {
        try {
            if (require('get-cursor-position').sync()) {
                this.bar = new ProgressBar({
                    schema: "[:bar.gradient(red,green)] :current.blue of :total hits loaded.blue :percent.green :elapseds :etas",
                    total
                })
            }
        } catch (err) {
            console.log(`Progress bar could not be loaded.`);
        }
    }

    public tick(by: number) {
        if (this.bar) this.bar.tick(by);
    }
}

export class ElasticResultHandler {
    query: ElasticQueryExecutor;
    result: ElasticResult;
    url: string;

    public constructor(query: ElasticQueryExecutor, url: string) {
        this.query = query;
        this.url = url;
    }

    private push(target, startIndex, elements) {
        elements.forEach((element, index) => {
            target[startIndex + index] = element;
        });
    }

    private doUrlQuery(query: ElasticQueryItem, onLoaded: (resolve, reject, result: ElasticResult) => Promise<any>, fromItem: number = 0) {
        return new Promise((resolve, reject) => {
            this.query.execute(this.url, query.getBody(fromItem))
                .then((result: ElasticResult) => {
                    new FileCache().set(query.range, query.query, fromItem, result);
                    return onLoaded(resolve, reject, result);
                })
                .catch(reject);
        });
    }

    private doCacheQuery(query: ElasticQueryItem, onLoaded: (resolve, reject, result: ElasticResult) => Promise<any>, fromItem: number = 0) {
        return new Promise((resolve, reject) => {
            new FileCache().get(query.range, query.query, fromItem)
                .then((result: ElasticResult) => {
                    return onLoaded(resolve, reject, result);
                }).catch(reject);
        });
    }

    private onResult(query: ElasticQueryItem,
        result: ElasticResult,
        progress,
        resultSize: number,
        index: number) {
        return new Promise((resolve, reject) => {
            const length = result.hits.hits.length;
            progress.tick(resultSize);
            if (index < result.hits.total) {
                return this.doCacheQueryFactory(query, (resolve, reject, response) => {
                    this.push(result.hits.hits, index, response.hits.hits);
                    return this.onResult(query,
                        result,
                        progress,
                        response.hits.hits.length,
                        index + response.hits.hits.length)
                        .then(resolve).catch(reject);
                }, index).then(resolve).catch(reject);
            }

            return resolve(result);
        });
    }

    private doCacheQueryFactory(query: ElasticQueryItem, onLoaded: (resolve, reject, result: ElasticResult) => Promise<any>, fromItem: number = 0) { 
        return new FileCache().has(query.range, query.query, fromItem)
            ? this.doCacheQuery(query, onLoaded, fromItem)
            : this.doUrlQuery(query, onLoaded, fromItem)
    }

    private shallowCloneElasticResult(result) {
        const total = result.hits.total;
        const resultSize = result.hits.hits.length;
        const hits = new Array(total);
    
        // shallow clone result with complete hits
        let resultContainer : any = { hits : {hits} };
        Object.keys(result).filter(key => key !== "hits").forEach(key => {
            resultContainer[key] = result[key];
        });
    
        Object.keys(result.hits).filter(key => key !== "hits").forEach(key => {
            resultContainer.hits[key] = result.hits[key];
        });
    
        this.push(resultContainer.hits.hits, 0, result.hits.hits);
    
        return resultContainer;
    }

    public start(query: string, range: DateRange) {
        return new Promise((resolve, reject) => {
            const queryItem = new ElasticQueryItem(query, range);
            return this.doCacheQueryFactory(queryItem, (resolve, reject, result) => {
                const total = result.hits.total;
                if (total < 1) {
                    console.log(`No results for this query.`);
                    return resolve(result);
                }

                if (total <= queryItem.getSize()) {
                    return resolve(result);
                }

                console.log(`Found ${total} results. Please wait while loading.`);

                const resultSize = result.hits.hits.length;
                const resultContainer = this.shallowCloneElasticResult(result);

                const bar = new ProgressBarWrapper(total);
                this.onResult(queryItem, resultContainer as ElasticResult, bar, resultSize, resultSize)
                    .then(resolve)
                    .catch(reject);
            }).then(resolve).catch(reject);
        });
    }
}

export class ElasticQuery implements Queryable {
    url: string;

    public constructor(url, index) {
        this.url = `${url}/${index}/_search`
    }

    public doQuery(query: string, range: DateRange) {
        return new ElasticResultHandler(new ElasticQueryExecutor(), this.url).start(query, range);
    }
}
