import * as request from 'request';
import * as moment from 'moment';
import { RequestBodySearch, BoolQuery, RangeQuery, QueryStringQuery, Sort } from "elastic-builder";
import { ElasticResult } from "../models/ElasticResult";
import { Queryable } from "./Queryable";
import { DateRange } from "../models/Date";
import { FileCache } from "./FileCache";
import { Client } from "elasticsearch";
require("dotenv").config();
var ProgressBar = require('ascii-progress');

export const requestWrapper = request;
export const ClientWrapper = Client;
const size = process.env.ELMAP_QUERYBATCH || 10;
const timestampField = process.env.ELMAP_TIMESTAMP || "@timestamp";

export class NativeElasticQueryExecutor {
    index: string;

    public constructor(index: string) {
        this.index = index;
    }

    public execute(url: string, body: Object, onLoaded) {
        return new Promise((resolve, reject) => {
            let found = 0;
            const client = new ClientWrapper({ hosts: [url] });
            const result = { hits : { hits : null, total : 0} };
            const headers = {
                "kbn-xsrf": "reporting"
            };
            client.search({
                index: this.index,
                scroll: "30s", // keep the search results "scrollable" for 30 seconds
                size,
                body,
                headers 
            }, function getMoreUntilDone(error, response) {
                if (error) { return reject(error); }

                // collect the title from each response
                if (!result.hits.hits) { 
                    result.hits.hits = new Array(response.hits.total); 
                    result.hits.total = response.hits.total;
                }
                response.hits.hits.forEach((element, index) => {
                    result.hits.hits[found + index] = element;
                });
                
                onLoaded(response, found);
                found += response.hits.hits.length;

                if (response.hits.total > found) {
                    // ask elasticsearch for the next set of hits from this search
                    client.scroll({
                        scrollId: response._scroll_id,
                        scroll: "30s",
                        headers
                    }, getMoreUntilDone);
                } else {
                    console.log("scroll search complete");
                    resolve(result);
                }
            });
        });
    }
}

class ElasticQueryItem {
    private body: Object;
    query: string;
    range: DateRange;

    public constructor(query, range) {
        this.query = query;
        this.range = range;
    }

    public getSize() {
        return size;
    }

    public getScrollBody() {
        const bodyBuilder = new RequestBodySearch();
        const boolQuery = new BoolQuery().must([
            new RangeQuery(timestampField)
                .from(this.range.from.getTime())
                .to(this.range.to.getTime()),
            new QueryStringQuery(this.query)
                .analyzeWildcard(true)
        ]);
        bodyBuilder.query(boolQuery);
        bodyBuilder.sort(new Sort(timestampField, "desc"))

        return bodyBuilder.toJSON();
    }

    public getBody(from: number) {
        const body = {
            "version": true,
            "from": from,
            "size": size,
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
                                    "range": {}
                                }
                            ]
                        }
                    }
                }
            },
            "fields": [
                "*",
                "_source"
            ],
            "script_fields": {},
            "fielddata_fields": []
        };
        body.query.filtered.filter.bool.must[0].range[timestampField] = {
            "gte": this.range.from,
            "lte": this.range.to
        }
        body.fielddata_fields.push(timestampField);
        return body;
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
    nativeQuery: NativeElasticQueryExecutor;
    result: ElasticResult;
    url: string;

    public constructor(nativeQuery: NativeElasticQueryExecutor, url: string) {
        this.nativeQuery = nativeQuery;
        this.url = url;
    }

    private push(target, startIndex, elements) {
        elements.forEach((element, index) => {
            target[startIndex + index] = element;
        });
    }

    private doUrlQuery(query: ElasticQueryItem, onLoaded: (resolve, reject, result: ElasticResult) => Promise<any>, fromItem: number = 0) {
        return new Promise((resolve, reject) => {
            this.nativeQuery.execute(this.url, query.getScrollBody(), (result, fromIndex) => {
                new FileCache().set(query.range, query.query, fromIndex, result);
            })
                .then((result: ElasticResult) => onLoaded(resolve, reject, result))
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
        let resultContainer: any = { hits: { hits } };
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
    index: string;

    public constructor(url, index) {
        this.index = index;
        this.url = url;
    }

    public doQuery(query: string, range: DateRange) {
        return new ElasticResultHandler(new NativeElasticQueryExecutor(this.index), this.url)
            .start(query, range);
    }
}
