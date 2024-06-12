"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceStamp = exports.dateStamp = void 0;
/* Utilities */
const log_1 = require("../utilities/log");
const dateStamp = () => {
    (0, log_1.log)("Generating Date Stamp");
    const today = new Date();
    const day = (() => {
        const currentDay = today.getDate();
        if (currentDay < 10) {
            return "0" + currentDay.toString();
        }
        else {
            return currentDay;
        }
    })();
    const month = (() => {
        const currentMonth = today.getMonth() + 1;
        if (currentMonth < 10) {
            return "0" + currentMonth.toString();
        }
        else {
            return currentMonth;
        }
    })();
    const year = today.getFullYear();
    return (`${year.toString().slice(2, 4)}.${month}.${day}`);
};
exports.dateStamp = dateStamp;
/**
 * Replaces **dateStamp** in any string with dateStamp
 * @param contents: string;
 */
const replaceStamp = (contents) => {
    (0, log_1.log)("Replacing Date Stamp");
    const date = (0, exports.dateStamp)();
    return contents.split("**dateStamp**").join(date);
};
exports.replaceStamp = replaceStamp;
//# sourceMappingURL=dateStamp.js.map