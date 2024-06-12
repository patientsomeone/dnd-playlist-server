import async from "async";
import debug from "debug";


import { log, logLine } from "../utilities/log";
import { elapsed, IAverageTime, IPerformance } from "../utilities/timeConversion";

const debPrefix = "utilities:asyncUtil";
const deAsyUtil = debug(debPrefix);
const deEaOfSer = debug(`${debPrefix}:eachOfSeries`);

export interface IasyncCallback {
    err?: string;
    value?: any;
}

export class AsyncUtil {
    /**
     * eachOfSeries Aruguments:
     * iteratee: Array or Object to be iterated over
     * iterator: Function to be executed for each item of iteratee
     * -- individualItem: Current item being processed
     * -- key: Number or key currently being processed
     * -- triggerNext: Function which will trigger next item to be processed.
     * -- counterLog: Function to trigger status counter with message
     */
    public static eachOfSeries(iteratee: any[] | object, iterator: (individualItem: string | number | boolean | {[key: string]: any;}, key: number | string, triggerNext: (stop?: any) => void | IasyncCallback, counterLog: (msg: string | false) => void) => void): Promise<void | IasyncCallback> {
        const countData = this.initCounter(iteratee);
        const timeStart = Date.now();

        return new Promise((resolve, reject) => {
            async.eachOfSeries(iteratee, (individualItem, key, triggerNext) => {
                const individualStart = Date.now();
                const triggerCounter = (msg: string | false) => {
                    // log(`${countData.trackedCount} / ${countData.totalCount}`);
                    this.counter(` ${msg || ""}`, countData.trackedCount, countData.totalCount, individualStart, timeStart);
                    
                    deEaOfSer(`EachOfSeries Status: ${Math.ceil(((countData.trackedCount) / countData.totalCount) * 100)}% | COMPLETE | ${countData.trackedCount} / ${countData.totalCount}`);
                };
                countData.trackedCount += 1;
                iterator(individualItem, key, triggerNext, triggerCounter);
            }, (data: IasyncCallback) => {
                deEaOfSer("Each of Series completion", data);
                if (!!data && data.hasOwnProperty("err") && data.err) {
                    deEaOfSer("Each of Series rejecting");
                    log(data.err);
                    reject();
                } else {
                    deEaOfSer("Each of Series resolving");
                    resolve(!!data && data.value);
                }
            });
        });
    }

    /**
     * eachOfLimit Aruguments:
     * iteratee: Array or Object to be iterated over
     * threads: Number of concurent threads, executions at a time
     * iterator: Function to be executed for each item of iteratee
     * -- individualItem: Current item being processed
     * -- key: Number or key currently being processed
     * -- triggerNext: Function which will trigger next item to be processed.
     * -- counterLog: Function to trigger status counter with message
     */
    public static eachOfLimit(iteratee: any[] | object, threads: number, iterator: (individualItem: string | number | boolean | {[key: string]: any;}, key: number | string, triggerNext: () => void | IasyncCallback, counterLog: (msg: string | false) => void) => void): Promise<void | IasyncCallback> {
        const countData = this.initCounter(iteratee);
        const timeStart = Date.now();
        return new Promise((resolve, reject) => {
            async.eachOfLimit(iteratee, threads, (individualItem, key, triggerNext) => {

                deEaOfSer(`trackedCount ${countData.trackedCount}`);

                countData.trackedCount += 1;

                const individualStart = Date.now();

                const triggerCounter = (msg: string | false) => {
                    this.counter(`${!msg ? "" : msg + " | "}`, countData.trackedCount, countData.totalCount, individualStart, timeStart);
                };

                deEaOfSer(`EachOfSeries Status: ${Math.ceil(((countData.trackedCount) / countData.totalCount) * 100)}% | COMPLETE | ${countData.trackedCount} / ${countData.totalCount}`);

                iterator(individualItem, key, triggerNext, triggerCounter);
            }, (data: {err: string; value: any;}) => {
                deEaOfSer("Each of Limit completion", data);
                if (!!data && data.hasOwnProperty("err") && !!data.err) {
                    deEaOfSer("Each of Limit rejecting");
                    log(data.err);
                    reject();
                } else {
                    deEaOfSer("Each of Limit resolving");
                    resolve(!!data && data.value);
                }
            });
        });
    }

    private static average = 0;

    private static counter(msg: string, key: number, total: number, individualStart: number, timeStart: number) {
        const debCounter = debug(`${debPrefix}:counter:count`);
        const endTime = Date.now();
        this.average = ((this.average + (endTime - individualStart)) / 2);

        logLine(`${msg}`);
        logLine(`${Math.round(((key) / total) * 100)}% COMPLETE`, 2);
        logLine(`${key} / ${total}`, 3);
        logLine(`Total Time: ${elapsed(timeStart, endTime)}`, 2);
        logLine(`Iteration Time: ${elapsed(individualStart, endTime)}`, 3);
        logLine(`Estimated: ${elapsed(0, (this.average * (total - Math.round(key))))}`, 3);
        // logLine(`${msg}${((key) / total)}% | COMPLETE | ${key} / ${total}`);
    }

    private static initCounter(iteratee) {
        const countProperties = {
            totalCount: 0,
            trackedCount: 0
        };

        const debCounter = debug(`${debPrefix}:counter:init`);

        debCounter("Initializing Counter");
        debCounter(iteratee);

        if (typeof iteratee !== "object") {
            logLine("Counter Fail");
            logLine(`Iteratee: ${iteratee as string} is not an object`);
            logLine("End Counter Fail");
        } else if (iteratee === null) {
            logLine("Counter Fail");
            logLine(`Iteratee: ${iteratee as string} is null`);
            logLine("End Counter Fail");
        } else {
            countProperties.totalCount = Object.keys(iteratee).length;
        }

        return countProperties;
    }
}
