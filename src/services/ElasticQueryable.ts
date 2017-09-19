import * as request from 'request';
import * as moment from 'moment';
import { ElasticResult } from "../models/ElasticResult";
import { Queryable } from "./Queryable";
import { DateRange } from "../models/Date";
var ProgressBar = require('ascii-progress');

export class ElasticQueryExecutor {
    public execute(url: string, json: Object) {
        return new Promise((resolve, reject) => {
            request({ method: "POST", url, json }, (err, result) => {
                if (err || result.statusCode > 399) return reject(err || new Error(result.body.error));
                else resolve(result.body);
            });
        });
    }
}

class ElasticQueryItem {
    private body: Object;
    private size = 25;
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

export class ElasticResultHandler {
    query: ElasticQueryExecutor;
    result: ElasticResult;
    url: string;

    public constructor(query: ElasticQueryExecutor, url: string) {
        this.query = query;
        this.url = url;
    }

    private doQuery(query: ElasticQueryItem, onLoaded: (resolve, reject, result: ElasticResult) => Promise<any>, fromItem: number = 0) {
        return new Promise((resolve, reject) => {
            this.query.execute(this.url, query.getBody(fromItem))
                .then((result: ElasticResult) => {
                    return onLoaded(resolve, reject, result);
                })
                .catch(reject);
        });
    }

    private onResult(query: ElasticQueryItem, result: ElasticResult, progress, resultSize : number) {
        return new Promise((resolve, reject) => {
            const length = result.hits.hits.length;
            progress.tick(resultSize);
            if (length < result.hits.total) {
                return this.doQuery(query, (resolve, reject, response) => {
                    result.hits.hits.push(...response.hits.hits);
                    return this.onResult(query, result, progress, response.hits.hits.length).then(resolve).catch(reject);
                }, result.hits.hits.length).then(resolve).catch(reject);
            }

            return resolve(result);
        });
    }

    public start(query: string, range: DateRange) {
        return new Promise((resolve, reject) => {
            const queryItem = new ElasticQueryItem(query, range);
            return this.doQuery(queryItem, (resolve, reject, result) => {
                const total = result.hits.total;
                if (total < 1) {
                    console.log(`No results for this query.`);
                    return resolve(result);
                }

                if (total <= queryItem.getSize()) {
                    return resolve(result);
                }

                console.log(`Found ${result.hits.total} results. Please wait while loading.`)
                const bar = new ProgressBar({
                    schema: "[:bar.gradient(red,green)] :current.blue of :total hits loaded.blue :percent.green :elapseds :etas",
                    total
                });
                this.onResult(queryItem, result, bar, result.hits.hits.length)
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
