/* UTILITIES */
import {anyStandard} from "../.types";
import { dBug, debLine } from "../utilities/dBug";
import { FsUtils } from "../utilities/fsUtils";
import { err, log, logLine } from "../utilities/log";
import { objectExtend } from "../utilities/objecExtend";
import { srcPath } from "../utilities/srcPath";
import {config} from "dotenv";

const debg = new dBug("utilities:fetchEnv");

type Env = {
    [key: string]: string;
};

config({path: "./.i.env"});

const env = process.env;

export const fetchEnv = async (key: string): Promise<string> => {
    const requestedEnv = env.hasOwnProperty(key) && key;
    
    return await (async () => {
        try {
            if (!requestedEnv) {
                log(`Environment Key ${key} not found`);
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