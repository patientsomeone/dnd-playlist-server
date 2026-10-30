/* UTILITIES */
import {anyStandard} from "../.types";
import { dBug, debLine } from "../utilities/dBug";
import { FsUtils } from "../utilities/fsUtils";
import { err, log, logLine } from "../utilities/log";
import { objectExtend } from "../utilities/objecExtend";
import { srcPath } from "../utilities/srcPath";
import "./environment";

const debg = new dBug("utilities:fetchEnv");

type Env = {
    [key: string]: string;
};

const env = process.env;

export const fetchEnv = (key: string): Promise<string> => {
    const value = env[key];
    if (!Object.prototype.hasOwnProperty.call(env, key) || value === undefined) {
        return Promise.reject(new Error(`Environment Key ${key} not found`));
    }
    return Promise.resolve(value);
};

const test = async (): Promise<void> => {
    try {
        const pwd = await fetchEnv("PWD");
        logLine("PWD Located");
        log(pwd);
    } catch (error) {
        log(error);
        process.exit(1);
    }
    try {
        const nonExistant = await fetchEnv("NONEXISTANT");
        logLine("nonExistant Located");
        log(nonExistant);
    } catch (error) {
        log(error);
        process.exit(1);
    }
};

// (async () => {
//     await test();
// })();
