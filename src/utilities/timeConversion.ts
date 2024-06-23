import { log } from "../utilities/log";

export interface IPerformance {
    allStart: number;
    allEnd: number;
    individual: number[];
}

export interface IAverageTime {
    start: number;
    end: number;
}

export const currentTime = (timeZone?: string): string => {
    const currentTime = new Date(Date.now());

    return currentTime.toLocaleString("en-US", {timeZone: timeZone || "america/los_angeles"});
};


/**
 * Convert human readable values into milliseconds for some reason...
 * @param inputObject Values to be converted
 */
export const convert = (inputObject: {/* month?: number,  */day?: number; hour?: number; minute?: number; second?: number;}): number => {
    const convert = {
        // month: {
        //     previous: "day",
        //     ofPrevious: 30
        // },
        day: {
            previous: "hour",
            ofPrevious: 24
        },
        hour: {
            previous: "minute",
            ofPrevious: 60
        },
        minute: {
            previous: "second",
            ofPrevious: 60
        },
        second: {
            ofPrevious: 1000
        }
    };
    let result = 0;

    const toMs = (num: number, inputType: string): number => {
        const toLarger = convert[inputType].ofPrevious * num;

        if (convert[inputType].hasOwnProperty("previous")) {
            const nextConversion = convert[inputType].previous as /* "month" |  */"day" | "hour" | "minute" | "second";
            return toMs(toLarger, nextConversion);
        } else {
            return toLarger;
        }
    };

    for (const key in inputObject) {
        if (inputObject.hasOwnProperty(key)) {
            result += toMs(inputObject[key], key);
        }
    }

    return result;
};

/**
 * Calculate and return human readable elapsed time.
 * @param start Timer Beginning EPOC
 * @param end Timer Ending EPOC
 * @param outputFormat Format to be output
 *    * "short": MM:dd:hh:mm:ss
 *    * "med": XXM XXd XXh XXm XXms
 *    * "long": XX months XX days XX hours XX minutes
 */
export const elapsed = (start: number, end: number, outputFormat?: "short" | "med" | "long") => {
    const total = end - start || 0;
    // let elap = total;
    // let ms = elap;
    const convert = {
        // millisecond: 1,
        second: {
            previous: "millisecond",
            ofPrevious: 1000
        },
        minute: {
            previous: "second",
            ofPrevious: 60
        },
        hour: {
            previous: "minute",
            ofPrevious: 60
        },
        day: {
            previous: "hour",
            ofPrevious: 24
        // },
        // month: {
        //     previous: "day",
        //     ofPrevious: 30
        }
    };
    // let lastUnit = "millisecond";
    const returnTime = {
        // month: 0,
        day: 0,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: total
    };

    // const subTime = (remainder, key): number => {
    //     for (let i = returnTime.length; --i; i >= 0) {
    //         if (i % 2 !== 0) {
    //             return convert[key] * remainder;
    //         }
    //     }
    // }

    for (const key in convert) {
        if (convert.hasOwnProperty(key)) {
            if (convert[key].hasOwnProperty("previous") && (returnTime[convert[key].previous] > convert[key].ofPrevious)) {
                const previousTime = returnTime[convert[key].previous];
                const ofPrevious = convert[key].ofPrevious;
                const currentTime = Math.floor(previousTime / ofPrevious);

                returnTime[key] = currentTime;

                // returnTime[key] = currentTime;

                returnTime[convert[key].previous] = previousTime - (currentTime * convert[key].ofPrevious);
            } else {
                break;
            }
            // if (elap > convert[key]) {
            //     elap = Math.floor(elap / convert[key]);

            //     ms = (total - subTime(ms, key));
            //     returnTime = [elap, key].concat(returnTime);
            // } else {
            //     // returnTime = [elap, lastUnit];
            //     break;
            // }
            
            // returnTime = [Math.floor(ms), lastUnit].concat(returnTime);
        }
    }
    const convertArray = (format: "short" | "med" | "long") => {
        const converter = {
            short: (): string => {
                const shortFormArray = [];

                for (const key in returnTime) {
                    if (returnTime.hasOwnProperty(key)) {
                        const convertShort = (num: number): string => {
                            const numStr = num.toString();
                            if (numStr.length < 2) {
                                return ("0" + numStr);
                            } else {
                                return numStr;
                            }
                        };

                        shortFormArray.push(convertShort(returnTime[key]));
                    }
                }

                return shortFormArray.join(":");
            },
            med: (): string => {
                const longFormArray = [];

                const medConverter = {
                    // month: "M",
                    day: "d",
                    hour: "h",
                    minute: "m",
                    second: "s",
                    millisecond: "ms"
                };

                for (const key in returnTime) {
                    if (returnTime.hasOwnProperty(key) && returnTime[key] > 0) {
                        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                        longFormArray.push(returnTime[key] + medConverter[key]);
                    }
                }
                return longFormArray.join(" ");
            },
            long: (): string => {
                const longFormArray = [];

                for (const key in returnTime) {
                    if (returnTime.hasOwnProperty(key) && returnTime[key] > 0) {
                        longFormArray.push(returnTime[key], key + (returnTime[key] === 1 ? "" : "s"));
                    }
                }
                return longFormArray.join(" ");
            }
        };

        if (converter.hasOwnProperty(format)) {
            return converter[format]();
        }
    };

    return convertArray(outputFormat || "short");
};

const test = () => {
    log(elapsed(1, 100000, "short"));
    log(elapsed(1, 100000, "med"));
    log(elapsed(1, 100000, "long"));
    log(elapsed(0, 10000000, "short"));
    log(elapsed(0, 10000000, "med"));
    log(elapsed(0, 10000000, "long"));
    log(elapsed(1, 100000000, "short"));
    log(elapsed(1, 100000000, "med"));
    log(elapsed(1, 100000000, "long"));

    const convertTest = {
        day: 1,
        hour: 1,
        minute: 1,
        second: 1
    };

    log(convert(convertTest));
    log(elapsed(0, convert(convertTest), "long"));
};

// test();
