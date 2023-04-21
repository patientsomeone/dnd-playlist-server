import * as debug from "debug";
import {anyStandard} from "../.types";

export const debLine = (title?: string): string => {
    if (title) {
        return `~-~-~-~-~-~-~ ${title} ~-~-~-~-~-~-~`;
    } else {
        return "~-~-~-~-~-~-~ ~-~-~-~-~-~-~ ~-~-~-~-~-~-~";
    }
};
export class dBug {
    private prefixedBugger: string;

    /**
     * Generate debugger prefix
     *   RECOMMENDATION: Prefix as path
     *     folderName:fileName
     */
    constructor(prefix: string) {
        this.prefixedBugger = prefix;
    }

    private generateSuffix = (suffix?: string | false): string => {
        if (!suffix) {
            const rex = /^(.*at |@ )(\S*)/gm;
            const res = Array.from((new Error().stack || "").matchAll(rex));
            // const [matchOne, matchTwo, matchThree] = (new Error().stack || "").matchAll(rex);
            const invalidCommon = ["dBug", "new", "dnd-playlist-server", "Generator.next", "__awaiter"];
            const invalidCheck = new RegExp(invalidCommon.join("|"), "g");
            const functionName = (() => {
                for (const result of res) {
                    const match = result[2].match(invalidCheck);
                    if (!match) {
                        return result[2].split("Function.").join("Static.");
                    }
                }
            })();

            return `${this.prefixedBugger}:${functionName}`;
        }

        return `${this.prefixedBugger}:${suffix}`;
    };

    /**
     * Generate debugger with suffix
     * - DEFAULT: calling Function Name
     * - RECOMMENDATION: suffix as method name
     * -  - {folderName:fileName:}methodName
     */
    public set = (suffix?: string | false): debug.IDebugger => {
        return debug(this.generateSuffix(suffix));
    };

    /**
     * Generate chainable debugger
     * - REQUIRES `.call()` execution.
     * - DEFAULT: calling Function Name
     * - RECOMMENDATION: suffix as method name
     * -  - {folderName:fileName:}methodName
     */
    public append = (suffix?: string | false): dBug => {
        const newDeb = new dBug(this.generateSuffix(suffix));

        return newDeb;
    };

    /**
     * Calls dbug with generated prefix
     */
    public call = (msg?: anyStandard): debug.IDebugger => {
        if (!msg) {
            return debug(this.prefixedBugger);
        } else {
            debug(this.prefixedBugger)(msg);
        }
    };

    public enabled = (): boolean => {
        // return debug.enabled(this.prefixedBugger);
        this.call(`Please remove execution of dbug.enabled at ${this.generateSuffix()}`);
        return false;
    };
}

const testFunc = () => {
    const deb = new dBug("test1");
    const test = deb.set("testString");
    test("Testing Debug String Suffix");
    test(deb.enabled().toString());

    const testTwo = new dBug("test2").set(false);
    testTwo("Testing Debug false Suffix");
    
    const testThree = () => {
        const debThree = new dBug("test3").set(false);
        debThree("Testing Debug nested false Suffix");
    };
    testThree();

    const testFour = new dBug("test4").set();
    testFour("Testing Debug null");

    const testFive = () => {
        testTwo("Testing Debug nested parent false Suffix");
    };
    testFive();

    const testDebSix = new dBug("test6appendDeb");
    testDebSix.call("Testing Debug Append");

    const testAppend = () => {
        testDebSix.append().call("Testing Debug nested parent Append");

        const testAppendNest = () => {
            testDebSix.append().call("Testing Debug double nested Append");
        };
        testAppendNest();
    };
    testAppend();
};

// testFunc();
