/*-- Modules --*/
import * as async from "async";
import * as parseCsv from "csv-parse";
import * as debug from "debug";
import * as fastCsv from "fast-csv";
import * as fs from "fs";

/*-- Utilities --*/
import { parser } from "marked";
import { FsUtils } from "../utilities/fsUtils";
import { AsyncUtil, IasyncCallback } from "./asyncUtil";
import { log, logLine } from "./log";

/*-- Define Column URL is located at --*/
const checkCol = 1;

/*-- DEBUGGERS --*/
// const log = debug("log:utilities:csv*");
const deRead = debug("utilities:csv:read");
const deWrite = debug("utilities:csv:write");
const deSani = debug("utilities:csv:write:sanitize");
const deWebId = debug("utilities:csv:getWebIdColumn");

export type csvRow = string[][];

export class CSV {

    
    public static readStream(inputFile: string, lineCallback?: (line: string[], rowIteration: number) => Promise<void>): Promise<{value: csvRow}> {
        return new Promise((resolve, reject) => {
            deRead("CSV STREAM BEGIN");
            const sanitizeArray = (arr) => {
                return arr.map((currentString) => {
                    return String.prototype.trim.apply(currentString);
                });
            };

            let currentRow = 0;

            const rowCallback = (currentLine, rowIteration) => {
                if (typeof lineCallback === "function") {
                    deRead("Executing line callback");
                    return lineCallback(currentLine, rowIteration);
                } else {
                    deRead("No line callback provided, continuing");
                    return Promise.resolve();
                }
            };

            const stream = fs.createReadStream(inputFile);

            const csvStream = fastCsv()
                .on("data", (data) => {
                    stream.pause();
                    const trimRow = sanitizeArray(data);
                    deRead("Current Row", trimRow);

                    rowCallback(trimRow, currentRow)
                        .then(() => {
                            deRead(`ROW COMPLETE`);
                            deRead(trimRow);
                            stream.resume();
                        });
                    currentRow += 1;
                })
                .on("end", () => {
                    resolve();
                });

            stream.pipe(csvStream);
        });
    }

    public static read(inputFile: string, lineCallback?: (line: string[], rowIteration: number) => Promise<void>, restrictCount?: number): Promise<{value: csvRow}> {
        return new Promise((resolve, reject) => {
            deRead("CSV READ BEGIN");
            this.trimmedData = [];
            this.totalRows = 0;
            this.rowCallback = (currentLine, rowIteration) => {
                if (typeof lineCallback === "function") {
                    deRead("Executing line callback");
                    return lineCallback(currentLine, rowIteration);
                } else {
                    deRead("No line callback provided, continuing");
                    return Promise.resolve();
                }
            };

            const sanitizeArray = (arr) => {
                return arr.map((currentString) => {
                    return String.prototype.trim.apply(currentString);
                });
            };

            const parser = parseCsv({ delimiter: "," }, (err, data) => {
                if (err) {
                    deRead("Error encountered", err);
                }

                AsyncUtil.eachOfLimit(data, restrictCount || 3, (line, key, triggerNext, counterLog) => {
                    const trimRow = sanitizeArray(line);
                    const currentKey = (typeof key === "number" ? key : parseInt(key, 10));

                    this.totalRows += 1;
                    this.trimmedData.push(trimRow);

                    deRead("Current Row", trimRow);

                    counterLog("Processesing CSV");
                    this.rowCallback(trimRow, currentKey)
                        .then(triggerNext);
                })
                    .then(() => {
                        resolve({value: this.trimmedData});
                    });
            });

            fs.createReadStream(inputFile).pipe(parser);
        });
    }

    public static write(parameters: { outputFile: string, data: csvRow }): Promise<string> {
        return new Promise((resolve, reject) => {
            deWrite("CSV WRITE BEGIN");
            deWrite("Parameters given: ", parameters);
            
            CSV.sanitizeData(parameters.data)
                .then((sanitized) => {
                    fs.createWriteStream(parameters.outputFile, {flags: "a+"}).write(sanitized);
                    deWrite("CSV WRITE COMPLETE");
                    resolve(parameters.outputFile);
                });

        });
    }

    public static getData() {
        return this.trimmedData;
    }

    /**
     * Process each item of a given row
     * row: Row to be processed
     * eachExecution: Array of functions to be executed
     *  * Functions will be executed against each column of provided row in order
     */
    public static processRow(row: string[], eachExecution: Array<((individualItem: string, columnNumber: number) => Promise<any>)>) {
        const executeRow = (cell, key) => {
            if (typeof eachExecution[key] === "function") {
                return eachExecution[key](cell, key);
            } else {
                log(`No function provided for column ${key}`);
                Promise.reject("Provided function is not a function...");
            }
        };

        const execute = () => {
            return AsyncUtil.eachOfLimit(row, 3, (cell, key, callback) => {
                executeRow(cell, key)
                    .then(callback);
                });
        };

        const reject = (): Promise<IasyncCallback> => {
            return Promise.reject("Provided Row and Function arrays do not match length.");
        };

        if (row.length === eachExecution.length) {
            return execute();
        } else {
            return reject();
        }
    }

    public static getWebIdColumn(headerRow: string[]) {
        const checkCell = (input): boolean => {
            const valueChecks = ["webid", "web id", "web-id"];
            deWebId(`Checking column header: ${input.toLowerCase()}`);

            for (let i = valueChecks.length - 1; i >= 0; i -= 1) {
                deWebId(`Comparing: ${input.toLowerCase()} && ${valueChecks[i]}. i = ${i}`);

                if (input.toLowerCase() === valueChecks[i]) {
                    deWebId("Returned true");
                    return true;
                }
            }

            deWebId("Returned false");
            return false;
        };

        const funcArray: Array<typeof eachFunction> = [];
        const webIdColumn = {
            value: 0,
            headersDefined: false
        };

        const eachFunction = (currentCell: string, columnNumber: number): Promise<void | {value: number}> => {
            return new Promise ((resolve) => {
                if (checkCell(currentCell)) {
                    deWebId(`WebID Located in ${columnNumber}, ${currentCell}; resolving`);
                    webIdColumn.value = columnNumber;
                    webIdColumn.headersDefined = true;
                    resolve({value: columnNumber});
                }
                resolve();
            });
        };

        deWebId(`Provided header row: ${headerRow}`);

        for (let i = headerRow.length - 1; i >= 0; i -= 1) {
            funcArray.push(eachFunction);
        }

        return this.processRow(headerRow, funcArray)
            .then((data) => {
                deWebId("processRow data:", data);
                return webIdColumn;
            });
    }

    private static inputFile: string;
    private static rowCallback: (currentLine: string[], rowIteration: number) => Promise<void | IasyncCallback> ;
    private static trimmedData: csvRow;
    private static totalRows: number;

    private static sanitizeData(data: csvRow): Promise<string> {
        return new Promise((resolve, reject) => {
            const tempData = [];
            function sanitizeRow(row) {
                deSani("Sanitizing Row");
                deSani(row);
                deSani(`Row is Array: ${Array.isArray(row)}`);
                return row.map((currentString) => {
                    const wrapper = ["\"", "\""];
                    deSani(`${currentString} is null: ${currentString === null}`);

                    if (typeof currentString === "undefined") {
                        currentString = "err_undefined";
                    } else if (currentString === null) { 
                        currentString = "err_null";
                    } else if (typeof currentString !== "string") {
                        currentString = currentString.toString();
                    }

                    let temporaryString = !!currentString && currentString.trim();

                    if (temporaryString && temporaryString.indexOf("\"") >= 0) {
                        temporaryString = temporaryString.split("'").join("\\'");
                        temporaryString = temporaryString.split("\"").join("'");
                    } else if (!temporaryString) {
                        deSani("Current String is not sanitizable");
                        deSani(temporaryString);
                        temporaryString = "";
                    }

                    return wrapper.join(temporaryString);
                });
            }

            deSani("Attempting to sanitize");
            deSani(data);
            // deSani("--------------- END SANITIZE DATA ---------------")

            for (let i = data.length - 1; i >= 0; i -= 1) {
                deSani(`Sanitizing row ${i}`, data[i]);
                tempData.unshift(sanitizeRow(data[i]).join(","));
            }

            resolve(tempData.join("\n"));
        });
    }
    private writeStream: fs.WriteStream;
    private output: string;

    constructor(outputFile: string) {
        this.writeStream = fs.createWriteStream(outputFile);
        this.output = outputFile;
    }
    public stream(data: csvRow): Promise<string> {
        return new Promise((resolve, reject) => {
            deWrite(" ------- CSV WRITE BEGIN ------- ");
            deWrite("Data given: ", data);
            
            deWrite("Sanitizing data ", data);
            CSV.sanitizeData(data)
                .then((sanitized) => {
                        deWrite("Sanitized data: ", data);
                        this.writeStream.write(sanitized + "\n");
                        resolve(this.output);
                    });
        });
    }
}

/* Parse.begin(input, (currentRow) => {
    deBase("Executing row", currentRow);
}).then(
    deBase("Trimmed Data:", Parse.getData())
); */
