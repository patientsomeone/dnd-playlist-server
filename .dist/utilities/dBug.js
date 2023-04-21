"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dBug = exports.debLine = void 0;
const debug = __importStar(require("debug"));
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
            return debug(this.generateSuffix(suffix));
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
                return debug(this.prefixedBugger);
            }
            else {
                debug(this.prefixedBugger)(msg);
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