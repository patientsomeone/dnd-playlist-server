/*-- MODULES --*/
import * as debug from "debug";

/*-- UTILITIES --*/
import { log, logLine } from "../utilities/log";
import { CSV, csvRow } from "../utilities/processCSV";
import { elapsed, IAverageTime, IPerformance } from "../utilities/timeConversion";
import { AsyncUtil } from "./asyncUtil";

interface IargumentMap {
    [argument: string]: () => any;
}

export const executeArguments = (argumentMap: IargumentMap, passedArguments?: string[]) => {
    const currentArguments = (passedArguments || process.argv);

    AsyncUtil.eachOfSeries(currentArguments, (argument, triggerNext, callback, counterLog) => {
        if (typeof argument === "string") {
            if (argumentMap.hasOwnProperty(argument)) {
                counterLog(argument);
                argumentMap[argument]();
            }
        }
        callback();
    });
};
