/* Utilities */
import { log } from "../utilities/log";

export const dateStamp = () => {
    log("Generating Date Stamp");
    const today = new Date();
    const day = (() => {
        const currentDay = today.getDate()
        if (currentDay < 10) {
            return "0" + currentDay.toString();
        } else {
            return currentDay;
        }
    })();
    const month = (() => {
        const currentMonth = today.getMonth() + 1;
        if (currentMonth < 10) {
            return "0" + currentMonth.toString();
        } else {
            return currentMonth;
        }
    })();;
    const year = today.getFullYear();

    return (`${year.toString().slice(2,4)}.${month}.${day}`);
};

/**
 * Replaces **dateStamp** in any string with dateStamp
 * @param contents 
 */
export const replaceStamp = (contents) => {
    log("Replacing Date Stamp");
    const date = dateStamp();

    return contents.split("**dateStamp**").join(date);
}