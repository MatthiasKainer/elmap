import * as fs from "fs";
import { DateRange } from "../models/Date";

export class FileCache {

    private makePath(range: DateRange, query, create: boolean = true) {
        const dataFolder = process.env.ELMAP_PATH || "data";
        const root = `${process.cwd()}/${dataFolder}`;
        const target = `${root}/${range.from.getTime()}-${range.to.getTime()}-${query}`;
        if (create && !fs.existsSync(root)) fs.mkdirSync(root);
        if (create && !fs.existsSync(target)) fs.mkdirSync(target);
        return target;
    }

    public has(range, query, index: number = -1): boolean {
        return (index >= 0)
            ? fs.existsSync(`${this.makePath(range, query, false)}/${index}`)
            : fs.existsSync(this.makePath(range, query, false));
    }

    public validateCache(range, query, expectedShards): boolean {
        return fs.readdirSync(this.makePath(range, query)).length === expectedShards;
    }

    public get(range, query, index) {
        return new Promise((resolve, reject) => {
            fs.readFile(`${this.makePath(range, query)}/${index}`, "utf-8", (err, data) => {
                if (err) return reject(err);
                else return resolve(JSON.parse(data));
            })
        });
    }

    public set(range, query, index, content) {
        return new Promise((resolve, reject) => {
            const file = this.makePath(range, query);
            fs.writeFile(`${file}/${index}`, JSON.stringify(content), (err) => {
                return err ? reject(err) : resolve();
            });
        });
    }
}