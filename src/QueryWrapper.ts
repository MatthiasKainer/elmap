
import * as moment from 'moment';
import { Queryable } from "./services/Queryable";
import { ElasticResult } from "./models/ElasticResult";
import { FileCache } from "./services/FileCache";
import { DateRange } from "./models/Date";

const cache = new FileCache();

export function performQuery(query: string, range: DateRange, transform: (result: ElasticResult) => Object, queryable: Queryable): Promise<any> {
    range = Object.assign({ from: moment().subtract(15, 'minutes').toDate(), to: moment().toDate() }, range);
    transform = transform || ((_) => _);
    return new Promise((resolve, reject) => {
        let innerPromise = (cache.has(range, query))
            ? cache.get(range, query)
            : queryable.doQuery(query, range);

        innerPromise
            .then((result: ElasticResult) => {
                cache.set(range, query, result);
                resolve(transform(result));
            })
            .catch(reject);
    })
}