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
exports.logLine = exports.err = exports.log = void 0;
const debug = __importStar(require("debug"));
const dBug_1 = require("../utilities/dBug");
exports.log = debug("logger*");
exports.err = debug("---ERROR*");
const deb = new dBug_1.dBug("log");
/**
 * Pad text to a certain number of characters for uniform outputs
 * @param msg Message to be padded
 * @param indent Number of times to indent (by 5 "spaces");
 */
const padMsg = (msg, indent, newLineChar, isErr) => {
    const db = deb.set("padMsg");
    const indentCount = 5;
    let messageLength = 130;
    const workingMsg = msg;
    const pad = (toInsert, eqOnly) => {
        const pad = [];
        db(`Adding padding ${toInsert}`);
        for (let i = toInsert - 1; i >= 0; i -= 1) {
            if (!eqOnly && i > indentCount) {
                pad.push(" ");
            }
            else {
                pad.push("=");
            }
        }
        return pad.join("");
    };
    const getIndent = () => {
        const toInd = (indent * indentCount);
        messageLength -= toInd;
        return pad(toInd, true) + " " + (toInd === indentCount ? workingMsg.toUpperCase() : workingMsg);
    };
    let applyJoin = "";
    const getNewLine = (data, newLineChar, initialIndent) => {
        const nDb = deb.set("padMsg:getNewLine");
        let splitLines = [];
        const currentData = (data || workingMsg).toString();
        const strArr = (() => {
            const splitChecks = {
                " ": {
                    reapply: false
                },
                "|": {
                    reapply: false
                },
                "/": {
                    reapply: true
                }
            };
            nDb(`Processing Log ${currentData}`);
            nDb(`    data: ${data}`);
            nDb(`    workingMsg: ${workingMsg}`);
            if (newLineChar && currentData.indexOf(newLineChar) > 0) {
                return currentData.split(newLineChar);
            }
            else {
                for (const key in splitChecks) {
                    if (currentData.indexOf(key) >= 0) {
                        if (splitChecks[key].reapply) {
                            applyJoin = key;
                        }
                        return currentData.split(key);
                    }
                }
                return [currentData];
            }
        })();
        const updateIndent = () => {
            const newIndent = (splitLines.length > 1 ? ((initialIndent || indent) + 1) : (initialIndent || indent));
            // messageLength -= newIndent * indentCount;
            return newIndent;
        };
        const newOnChar = (currentItem) => {
            if (currentItem.length < (messageLength - updateIndent() * indentCount)) {
                splitLines.push(pad(updateIndent() * indentCount, true) + " " + currentItem /*  + pad(messageLength - currentItem.length) */);
            }
            else {
                splitLines = getNewLine(currentItem, false, updateIndent() + 1).concat(splitLines);
            }
        };
        let currentLine = pad(updateIndent() * indentCount, true);
        const newOnLength = (currentItem) => {
            db(`Processing New on Length`);
            db(`Input: ${currentItem}`);
            if ((currentItem.length + currentLine.length) < (messageLength - (updateIndent() * indentCount) - 4)) {
                db(`Adding to current Line`);
                if (currentLine.slice(-1) !== " " && currentLine.slice(-1) !== "/" && currentLine.slice(-1) !== "\\") {
                    db(`Current Line does not end in space, adding space`);
                    currentLine += " ";
                }
                currentLine += currentItem.trim() + applyJoin;
                db(`Current Line: ${currentLine}`);
            }
            else if ((currentItem.length + currentLine.length) >= (messageLength - updateIndent() * indentCount)) {
                db(`Too Long, breaking down`);
                // splitLines.push(currentLine + pad(messageLength - currentLine.length));
                db(`Current Split Lines: ${splitLines.join(" **&&** ")}`);
                splitLines = (getNewLine(currentItem, false, updateIndent() + 1)).concat(splitLines);
                applyJoin = "";
                db(`Broke down lines to ${splitLines.join("")}`);
            }
            else {
                splitLines.push(currentLine /*  + pad(messageLength - updateIndent() * indentCount) */);
                currentLine = pad(messageLength - updateIndent() * indentCount) + " " + currentItem.trim();
            }
            // splitLines.push(currentItem);
        };
        for (let i = 0; i < strArr.length; i += 1) {
            if (!newLineChar) {
                newOnLength(strArr[i]);
                if (i === strArr.length - 1) {
                    splitLines.unshift(currentLine + " " /*  + pad(messageLength - (currentLine.length - (!initialIndent ? ((updateIndent() - 1) * indentCount) : indentCount * 2) )) */);
                }
            }
            else {
                newOnChar(strArr[i]);
            }
        }
        // splitLines.push(currentLine);
        return splitLines;
    };
    const output = (msg) => {
        if (!isErr) {
            (0, exports.log)(msg);
        }
        else {
            (0, exports.err)(msg);
        }
    };
    if (!newLineChar && msg.length <= messageLength) {
        output(getIndent() + " " /* + pad(messageLength - msg.length) */);
    }
    else {
        const multiLine = getNewLine(false, newLineChar);
        for (let i = 0; i < multiLine.length; i += 1) {
            output(multiLine[i]);
        }
    }
    // log(getIndent() + " " + pad(messageLength - msg.length));
};
/**
 * Create a log message with a line
 * @param msg Message to be logged
 * @param indent Number of times to indent (by 5 spaces)
 * @param newLineCharacter Character to trigger a new line
 */
const logLine = (msg, indent, newLineCharacter, isErr) => {
    const sanitizedMessage = msg || "";
    const toIndent = indent ? indent + 1 : 1;
    return padMsg(sanitizedMessage, toIndent, newLineCharacter, isErr);
};
exports.logLine = logLine;
const test = () => {
    (0, exports.logLine)("This is a test message");
    (0, exports.logLine)("This is a second test message", 2);
    (0, exports.logLine)("This is a third message");
    (0, exports.logLine)("FILE PATH: /USERS/SEA-ROBINSJP-M/DOCUMENTS/_GIT/PARTNER-TOOLKIT/OUTPUTS/TOOLKITPROCESSOR/20.04.13_SITESCRAPE_IDENTIFIEDVENDOR.CSV | PROCESSED: HOLDEN-ALANMAY | ELAPSED: 00:00:00:06:53 | 0% | COMPLETE | 1 / 5658 | ELAPSED: 00:00:00:06:53", 0, "|");
};
// test();
//# sourceMappingURL=log.js.map