"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncUtil = void 0;
const async_1 = __importDefault(require("async"));
const debug_1 = __importDefault(require("debug"));
const log_1 = require("../utilities/log");
const timeConversion_1 = require("../utilities/timeConversion");
const debPrefix = "utilities:asyncUtil";
const deAsyUtil = (0, debug_1.default)(debPrefix);
const deEaOfSer = (0, debug_1.default)(`${debPrefix}:eachOfSeries`);
class AsyncUtil {
    /**
     * eachOfSeries Aruguments:
     * iteratee: Array or Object to be iterated over
     * iterator: Function to be executed for each item of iteratee
     * -- individualItem: Current item being processed
     * -- key: Number or key currently being processed
     * -- triggerNext: Function which will trigger next item to be processed.
     * -- counterLog: Function to trigger status counter with message
     */
    static eachOfSeries(iteratee, iterator) {
        const countData = this.initCounter(iteratee);
        const timeStart = Date.now();
        return new Promise((resolve, reject) => {
            async_1.default.eachOfSeries(iteratee, (individualItem, key, triggerNext) => {
                const individualStart = Date.now();
                const triggerCounter = (msg) => {
                    // log(`${countData.trackedCount} / ${countData.totalCount}`);
                    this.counter(` ${msg || ""}`, countData.trackedCount, countData.totalCount, individualStart, timeStart);
                    deEaOfSer(`EachOfSeries Status: ${Math.ceil(((countData.trackedCount) / countData.totalCount) * 100)}% | COMPLETE | ${countData.trackedCount} / ${countData.totalCount}`);
                };
                countData.trackedCount += 1;
                iterator(individualItem, key, triggerNext, triggerCounter);
            }, (data) => {
                deEaOfSer("Each of Series completion", data);
                if (!!data && data.hasOwnProperty("err") && data.err) {
                    deEaOfSer("Each of Series rejecting");
                    (0, log_1.log)(data.err);
                    reject();
                }
                else {
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
    static eachOfLimit(iteratee, threads, iterator) {
        const countData = this.initCounter(iteratee);
        const timeStart = Date.now();
        return new Promise((resolve, reject) => {
            async_1.default.eachOfLimit(iteratee, threads, (individualItem, key, triggerNext) => {
                deEaOfSer(`trackedCount ${countData.trackedCount}`);
                countData.trackedCount += 1;
                const individualStart = Date.now();
                const triggerCounter = (msg) => {
                    this.counter(`${msg + " | " || ""}`, countData.trackedCount, countData.totalCount, individualStart, timeStart);
                };
                deEaOfSer(`EachOfSeries Status: ${Math.ceil(((countData.trackedCount) / countData.totalCount) * 100)}% | COMPLETE | ${countData.trackedCount} / ${countData.totalCount}`);
                iterator(individualItem, key, triggerNext, triggerCounter);
            }, (data) => {
                deEaOfSer("Each of Limit completion", data);
                if (!!data && data.hasOwnProperty("err") && !!data.err) {
                    deEaOfSer("Each of Limit rejecting");
                    (0, log_1.log)(data.err);
                    reject();
                }
                else {
                    deEaOfSer("Each of Limit resolving");
                    resolve(!!data && data.value);
                }
            });
        });
    }
    static counter(msg, key, total, individualStart, timeStart) {
        const debCounter = (0, debug_1.default)(`${debPrefix}:counter:count`);
        const endTime = Date.now();
        this.average = ((this.average + (endTime - individualStart)) / 2);
        (0, log_1.logLine)(`${msg}`);
        (0, log_1.logLine)(`${Math.round(((key) / total) * 100)}% COMPLETE`, 2);
        (0, log_1.logLine)(`${key} / ${total}`, 3);
        (0, log_1.logLine)(`Total Time: ${(0, timeConversion_1.elapsed)(timeStart, endTime)}`, 2);
        (0, log_1.logLine)(`Iteration Time: ${(0, timeConversion_1.elapsed)(individualStart, endTime)}`, 3);
        (0, log_1.logLine)(`Estimated: ${(0, timeConversion_1.elapsed)(0, (this.average * (total - Math.round(key))))}`, 3);
        // logLine(`${msg}${((key) / total)}% | COMPLETE | ${key} / ${total}`);
    }
    static initCounter(iteratee) {
        const countProperties = {
            totalCount: 0,
            trackedCount: 0
        };
        const debCounter = (0, debug_1.default)(`${debPrefix}:counter:init`);
        debCounter("Initializing Counter");
        debCounter(iteratee);
        if (typeof iteratee !== "object") {
            (0, log_1.logLine)("Counter Fail");
            (0, log_1.logLine)(`Iteratee: ${iteratee} is not an object`);
            (0, log_1.logLine)("End Counter Fail");
        }
        else if (iteratee === null) {
            (0, log_1.logLine)("Counter Fail");
            (0, log_1.logLine)(`Iteratee: ${iteratee} is null`);
            (0, log_1.logLine)("End Counter Fail");
        }
        else {
            countProperties.totalCount = Object.keys(iteratee).length;
        }
        return countProperties;
    }
}
exports.AsyncUtil = AsyncUtil;
AsyncUtil.average = 0;
//# sourceMappingURL=asyncUtil.js.map