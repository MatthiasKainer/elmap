import * as fs from "fs";
import { DateRange } from "../models/Date";

export class FileCache {

    private makePath(range: DateRange, query) {
        const dataFolder = process.env.ELMAP_PATH || "data";
        const root = `${process.cwd()}/${dataFolder}`;
        if (!fs.existsSync(root)) fs.mkdirSync(root);
        return `${root}/${range.from.getTime()}-${range.to.getTime()}-${query}`;
    }

    public has(range, query): boolean {
        return fs.existsSync(this.makePath(range, query));
    }

    public get(range, query) {
        return new Promise((resolve, reject) => {
            fs.readFile(this.makePath(range, query), "utf-8", (err, data) => {
                if (err) return reject(err);
                else return resolve(JSON.parse(data));
            })
        });
    }

    public set(range, query, content) {
        if (!this.has(range, query)) {
            fs.writeFile(this.makePath(range, query), JSON.stringify(content), "utf-8", () => { });
        }
    }
}