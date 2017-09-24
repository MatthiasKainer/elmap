import * as request from 'request';
import * as moment from 'moment';
import { ElasticResult } from "../models/ElasticResult";
import { Queryable } from "./Queryable";
import { DateRange } from "../models/Date";
import { FileCache } from "./FileCache";
var ProgressBar = require('ascii-progress');

export class ElasticQueryExecutor {
    public execute(url: string, json: Object) {
        return new Promise((resolve, reject) => {
            const uri = require("url").parse(url);
            let auth = null;
            if (uri.auth) {
                auth = uri.auth;
                url = url.replace(uri.auth + "@", "");
            }
            request({ method: "GET", url, auth, json }, (err, result) => {
                if (err || result.statusCode > 399) return reject(err || new Error(result.body.error));
                else resolve((!result.body.hits ? JSON.parse(result.body) : result.body));
            });
        });
    }
}

class ElasticQueryItem {
    private body: Object;
    private size = 1000;
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

    private onResult(doQuery: (query: ElasticQueryItem, onLoaded: (resolve, reject, result: ElasticResult) => Promise<any>, fromItem: number) => Promise<any>,
        query: ElasticQueryItem,
        result: ElasticResult,
        progress,
        resultSize: number,
        index: number) {
        return new Promise((resolve, reject) => {
            const length = result.hits.hits.length;
            progress.tick(resultSize);
            if (length < result.hits.total) {
                return doQuery(query, (resolve, reject, response) => {
                    this.push(result.hits.hits, index, response.hits.hits);
                    return this.onResult(doQuery,
                        query,
                        result,
                        progress,
                        response.hits.hits.length,
                        index + response.hits.hits.length)
                        .then(resolve).catch(reject);
                }, result.hits.hits.length).then(resolve).catch(reject);
            }

            return resolve(result);
        });
    }

    public start(query: string, range: DateRange) {
        return new Promise((resolve, reject) => {
            const queryItem = new ElasticQueryItem(query, range);
            const doQuery = new FileCache().has(range, query)
                ? this.doCacheQuery.bind(this)
                : this.doUrlQuery.bind(this);
            return doQuery(queryItem, (resolve, reject, result) => {
                const total = result.hits.total;
                if (total < 1) {
                    console.log(`No results for this query.`);
                    return resolve(result);
                }

                if (total <= queryItem.getSize()) {
                    return resolve(result);
                }

                console.log(`Found ${result.hits.total} results. Please wait while loading.`);

                let resultSize = result.hits.hits.length;
                let hits = new Array(result.hits.total);

                const bar = new ProgressBarWrapper(total);
                this.onResult(doQuery, queryItem, result, bar, resultSize, resultSize)
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
