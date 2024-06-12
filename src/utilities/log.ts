import debug from "debug";
import {dBug} from "../utilities/dBug";

export const log = debug("logger*");
export const err = debug("---ERROR*");
const deb = new dBug("log");
/**
 * Pad text to a certain number of characters for uniform outputs
 * @param msg Message to be padded
 * @param indent Number of times to indent (by 5 "spaces");
 */
const padMsg = (msg: string, indent: number, newLineChar?: string, isErr?: boolean): void => {
    const db = deb.set("padMsg");
    const indentCount = 5;
    let messageLength = 130;
    const workingMsg = msg;
    
    const pad = (toInsert: number, eqOnly?: boolean) => {
        const pad = [];

        db(`Adding padding ${toInsert}`);

        for (let i = toInsert - 1; i >= 0; i -= 1) {
            if (!eqOnly && i > indentCount) {
                pad.push(" ");
            } else {
                pad.push("=");
            }
        }

        return pad.join("");
    };

    const getIndent = (): string => {
        const toInd = (indent * indentCount);
        messageLength -= toInd;

        return pad(toInd, true) + " " + (toInd === indentCount ? workingMsg.toUpperCase() : workingMsg);
    };

    let applyJoin = "";

    const getNewLine = (data?: string | false, newLineChar?: string | false, initialIndent?: number): string[] => {
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
            nDb(`    data: ${data.toString()}`);
            nDb(`    workingMsg: ${workingMsg}`);
            
            if (newLineChar && currentData.indexOf(newLineChar) > 0) {
                return currentData.split(newLineChar);
            } else {
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
        
        const updateIndent = (): number => {
            const newIndent = (splitLines.length > 1 ? ((initialIndent || indent) + 1) : (initialIndent || indent));
            // messageLength -= newIndent * indentCount;
            return newIndent;
        };

        const newOnChar = (currentItem: string) => {
            if (currentItem.length < (messageLength - updateIndent() * indentCount)) {
                splitLines.push(`${pad(updateIndent() * indentCount, true)} ${currentItem}`/*  + pad(messageLength - currentItem.length) */);
            } else {
                splitLines = getNewLine(currentItem, false, updateIndent() + 1).concat(splitLines);
            }
        };
        
        let currentLine = pad(updateIndent() * indentCount, true);

        const newOnLength = (currentItem: string) => {
            db("Processing New on Length");
            db(`Input: ${currentItem}`);

            if ((currentItem.length + currentLine.length) < (messageLength - (updateIndent() * indentCount) - 4)) {
                db("Adding to current Line");
                if (currentLine.slice(-1) !== " " && currentLine.slice(-1) !== "/" && currentLine.slice(-1) !== "\\") {
                    db("Current Line does not end in space, adding space");
                    currentLine += " ";
                }
                currentLine += currentItem.trim() + applyJoin;
                db(`Current Line: ${currentLine}`);
            } else if ((currentItem.length + currentLine.length) >= (messageLength - updateIndent() * indentCount)) {
                db("Too Long, breaking down");
                // splitLines.push(currentLine + pad(messageLength - currentLine.length));
                
                db(`Current Split Lines: ${splitLines.join(" **&&** ")}`);

                splitLines = (getNewLine(currentItem, false, updateIndent() + 1)).concat(splitLines);
                applyJoin = "";

                db(`Broke down lines to ${splitLines.join("")}`);
            } else {
                splitLines.push(currentLine/*  + pad(messageLength - updateIndent() * indentCount) */);
                currentLine = pad(messageLength - updateIndent() * indentCount) + " " + currentItem.trim();
            }
            // splitLines.push(currentItem);
        };

        for (let i = 0; i < strArr.length; i += 1) {
            if (!newLineChar) {
                newOnLength(strArr[i]);

                if (i === strArr.length - 1) {
                    splitLines.unshift(currentLine + " "/*  + pad(messageLength - (currentLine.length - (!initialIndent ? ((updateIndent() - 1) * indentCount) : indentCount * 2) )) */);
                }
            } else {
                newOnChar(strArr[i]);
            }
        }

        // splitLines.push(currentLine);
        
        return splitLines;
    };

    const output = (msg) => {
        if (!isErr) {
            log(msg);
        } else {
            err(msg);
        }
    };


    if (!newLineChar && msg.length <= messageLength) {
            output(getIndent() + " " /* + pad(messageLength - msg.length) */);
    } else {
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
export const logLine = (msg: string | false, indent?: number, newLineCharacter?: string, isErr?: boolean): void => {
    const sanitizedMessage = msg || "";
    const toIndent = indent ? indent + 1 : 1;

    return padMsg(sanitizedMessage, toIndent, newLineCharacter, isErr);
};

const test = () => {
    logLine("This is a test message");
    logLine("This is a second test message", 2);
    logLine("This is a third message");
    logLine("FILE PATH: /USERS/SEA-ROBINSJP-M/DOCUMENTS/_GIT/PARTNER-TOOLKIT/OUTPUTS/TOOLKITPROCESSOR/20.04.13_SITESCRAPE_IDENTIFIEDVENDOR.CSV | PROCESSED: HOLDEN-ALANMAY | ELAPSED: 00:00:00:06:53 | 0% | COMPLETE | 1 / 5658 | ELAPSED: 00:00:00:06:53", 0, "|");
};

// test();
