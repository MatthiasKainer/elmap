import { ElasticResult } from "./ElasticResult";

export default interface Config<T> {
    url : string;
    index : string;
    transform: (result: ElasticResult) => T;
}