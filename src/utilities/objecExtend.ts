/* Import UTILITIES */
import {dBug, debLine} from "./dBug";
import {log, logLine} from "./log";
import {anyArray, anyStandard, anyObject} from "../.types";

const debg = new dBug("utilities:objectExtend");

const testModule = false;

/**
 * First listed argument is default 
 */
export const objectExtend = (...args): anyObject => {
    const deb = debg.set("utilities:objectExtend");
    /* Set first argument as default */
    let defArg = args[0];
    let extended = {} as any;

    /* Loop through each argument passed */
    for (let i = 0; i < args.length; i += 1) {
        const thisArg = args[i];

        /* First listed argument is default */
        if (i === 0) {
            defArg = thisArg;
        } else {
            /* Additional args are to be merged */
            /* Loop through all items in objects */
            for (const key in thisArg) {
                if (thisArg.hasOwnProperty(key)) {
                    /* If an Array is passed */
                    if (Array.isArray(thisArg[key])) {
                        deb("Array Identified");
                        deb(thisArg[key]);
                        thisArg[key].isArray = true;
                    }

                    /* If an object is passed */
                    if (typeof thisArg[key] === "object") {
                        deb("Object Identified");
                        deb(thisArg[key]);
                        /* If default object has sub-object */
                        if (defArg.hasOwnProperty(key)) {
                            /* Extend from Default */
                            extended[key] = objectExtend(defArg[key], thisArg[key]);
                        } else {
                            /* Create new parameter */
                            extended[key] = thisArg[key];
                        }
                    } else {
                        extended[key] = thisArg[key];
                    }
                }
            }
        }

        // Check if nothing was extended
        const emptyExtend = Object.keys(extended).length < 1;
        
        
        /* Add default values for any missed values*/
        if (emptyExtend && typeof defArg === "string") {
            extended = defArg;
        } else {
            if (emptyExtend && Array.isArray(defArg)) {
                extended.isArray = true;
            }

            for (const key in defArg) {
                if (defArg.hasOwnProperty(key) && !extended.hasOwnProperty(key)) {
                    extended[key] = defArg[key];
                }
            }
        }


        if (extended.hasOwnProperty("isArray") && !!extended.isArray) {
            const newArray = [];

            deb("Converting Array");
            deb(extended);

            for (const key in extended) {
                if (extended.hasOwnProperty(key) && key !== "isArray") {
                    deb(`Processing ${key}`);
                    deb(extended[key]);
                    newArray.push(extended[key]);
                }
            }

            deb("Array Converted");
            deb(newArray);

            extended = newArray;
        }
    }

    return extended;
};

if (testModule) {
    (() => {
        const defObj = {
            testString: "Default",
            testObj: {
                unChanged: "Default",
                changed: "Default"
            },
            testEmpty: "",
            testMissing: "",
            testEmptyObject: {},
            testArray: ["Default1", "Default2"]
        };
        const ovrObj = {
            testString: "Overridden",
            testObj: {
                unChanged: "Default",
                changed: "Overridden"
            },
            testArray: ["Overridden1", "Overridden2"],
            testEmpty: "overridden",
            testEmptyOver: "",
            testEmptyObject: {"overriden":"true"},
            testMissingObject: {}
        };
        log(objectExtend(defObj, ovrObj));
    })();
}
