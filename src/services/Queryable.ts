import { DateRange } from "../models/Date";

export interface Queryable {
    doQuery(query: string, range: DateRange);
}