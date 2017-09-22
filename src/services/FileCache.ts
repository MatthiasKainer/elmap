const JSONStreamStringify = require("json-stream-stringify");

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
        return new Promise((resolve, reject) => {
            if (!this.has(range, query)) {
                var stream = fs.createWriteStream(this.makePath(range, query), { encoding: "utf-8" });
                JSONStreamStringify(content)
                    .pipe(stream)
                    .on("error", (err) => reject(err))
                    .on("end", () => {
                        console.log(`Cache entry written for ${this.makePath(range, query)}`);
                        resolve(this.makePath(range, query));
                    });
            }
        });
    }
}