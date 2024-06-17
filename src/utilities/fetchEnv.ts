/* UTILITIES */
import {anyStandard} from "../.types";
import { dBug, debLine } from "../utilities/dBug";
import { FsUtils } from "../utilities/fsUtils";
import { err, log, logLine } from "../utilities/log";
import { objectExtend } from "../utilities/objecExtend";
import { srcPath } from "../utilities/srcPath";

const debg = new dBug("utilities:fetchEnv");

interface Env {
    [key: string]: string;
}

const env = process.env;

export const fetchEnv = async (key: string): Promise<string> => {
    const requestedEnv = env.hasOwnProperty(key) && key;
    
    return await (async () => {
        try {
            if (!requestedEnv) {
                return Promise.reject(`Environment Key ${key} not found`);
            }

            return env[key];
        } catch (error) {
            throw(error);
        }
    })();
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