"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dBug = exports.debLine = void 0;
const debug_1 = __importDefault(require("debug"));
const debLine = (title) => {
    if (title) {
        return `~-~-~-~-~-~-~ ${title} ~-~-~-~-~-~-~`;
    }
    else {
        return "~-~-~-~-~-~-~ ~-~-~-~-~-~-~ ~-~-~-~-~-~-~";
    }
};
exports.debLine = debLine;
class dBug {
    /**
     * Generate debugger prefix
     *   RECOMMENDATION: Prefix as path
     *     folderName:fileName
     */
    constructor(prefix) {
        this.generateSuffix = (suffix) => {
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
        this.set = (suffix) => {
            return (0, debug_1.default)(this.generateSuffix(suffix));
        };
        /**
         * Generate chainable debugger
         * - REQUIRES `.call()` execution.
         * - DEFAULT: calling Function Name
         * - RECOMMENDATION: suffix as method name
         * -  - {folderName:fileName:}methodName
         */
        this.append = (suffix) => {
            const newDeb = new dBug(this.generateSuffix(suffix));
            return newDeb;
        };
        /**
         * Calls dbug with generated prefix
         */
        this.call = (msg) => {
            if (!msg) {
                return (0, debug_1.default)(this.prefixedBugger);
            }
            else {
                (0, debug_1.default)(this.prefixedBugger)(msg);
            }
        };
        this.enabled = () => {
            // return debug.enabled(this.prefixedBugger);
            this.call(`Please remove execution of dbug.enabled at ${this.generateSuffix()}`);
            return false;
        };
        this.prefixedBugger = prefix;
    }
}
exports.dBug = dBug;
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
//# sourceMappingURL=dBug.js.map