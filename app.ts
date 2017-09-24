import { performQuery } from "./src/QueryWrapper"
import { ElasticResult } from "./src/models/ElasticResult";
import { ElasticQuery } from "./src/services/ElasticQueryable";
import Config from "./src/models/Config";
import * as moment from 'moment';
import * as yaaaarr from "yargs";
import * as helpers from "./src/utils/helper";
import { DateRange } from "./src/models/Date";

function validateString(val: string, field: string) {
    if (!val || val.length < 1) throw new Error(`${field} cannot be null or empty`);
}

type ElmapParams<T> = {
    url : string,
    index : string,
    query : string,
    range : DateRange;
    transform : (result: ElasticResult) => T
}

export default function run<T>(params : ElmapParams<T>): Promise<T> {
    validateString(params.url, "The url of the elasticsearch instance");
    validateString(params.index, "The elastic search index");
    validateString(params.query, "The query");
    console.log(`Query for "${params.query}"`);
    return performQuery(params.query, params.range,  params.transform, new ElasticQuery(params.url, params.index));
}

export { helpers };

const argv = yaaaarr.argv;
if (argv.config && argv.query) {
    const config = require(argv.config);
    run({
        url: config.url, 
        index: config.index, 
        query : argv.query, 
        transform: config.transform,
        range : {
            from: moment(config.from).toDate(),
            to: moment(config.to).toDate()
        }
    });
} 