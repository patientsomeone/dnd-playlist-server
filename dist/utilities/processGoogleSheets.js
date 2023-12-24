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
exports.gSheet = void 0;
const debug = __importStar(require("debug"));
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
const googleapis_1 = require("googleapis");
/*-- Utilities --*/
const asyncUtil_1 = require("./asyncUtil");
const log_1 = require("./log");
/*-- Define Column URL is located at --*/
const checkCol = 1;
/*-- DEBUGGERS --*/
// const log = debug("log:utilities:gSheet*");
const deRead = debug("utilities:gSheet:read");
const deWrite = debug("utilities:gSheet:write");
const deConn = debug("utilities:gSheet:connect");
const deAuth = debug("utilities:gSheet:authorize");
const deSani = debug("utilities:gSheet:write:sanitize");
const deWebId = debug("utilities:gSheet:getWebIdColumn");
class gSheet {
    constructor(spreadsheetID) {
        //"1ozp-PrkrCZSMOwM6YK1XUYHq6MZdoqEME2n0QonSQ6M"
        this.tokenPath = "./.i.token.json";
        this.spreadsheetID = spreadsheetID;
        /* this.sheet = new googleSpreadsheets(spreadsheetID);

        this.sheet.useServiceAccountAuth(creds, (error) => {
            if (!error) {
                logLine("Connected to Google Spreadsheet");
            } else {
                logLine("UNABLE TO CONNECT TO SPREADSHEET");

                deConn("'.'.'.'.' BEGIN ERROR ENCOUNTERED '.'.'.'.'");
                deConn(error);
                deConn("'.'.'.'.'. END ERROR ENCOUNTERED '.'.'.'.'");
            }
        }) */
    }
    /**
     * WorksheetID derived from worksheet tab number, starting at 1.
     */
    read(range, lineCallback) {
        return new Promise((resolve, reject) => {
            (0, log_1.logLine)("gSheet READ BEGIN");
            this.trimmedData = [];
            this.totalRows = 0;
            this.rowCallback = (currentLine, rowIteration) => {
                if (typeof lineCallback === "function") {
                    deRead("Executing line callback");
                    return lineCallback(currentLine, rowIteration);
                }
                else {
                    deRead("No line callback provided, continuing");
                    return Promise.resolve();
                }
            };
            const sanitizeArray = (arr) => {
                return arr.map((currentString) => {
                    return String.prototype.trim.apply(currentString);
                });
            };
            const parser = this.sheet.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetID,
                range
            }, (err, data) => {
                if (err) {
                    deRead("Error encountered", err);
                }
                asyncUtil_1.AsyncUtil.eachOfLimit(data, 5, (line, key, triggerNext, counterLog) => {
                    const trimRow = sanitizeArray(line);
                    const currentKey = (typeof key === "number" ? key : parseInt(key, 10));
                    this.totalRows += 1;
                    this.trimmedData.push(trimRow);
                    deRead("Current Row", trimRow);
                    this.rowCallback(trimRow, currentKey)
                        .then(triggerNext);
                })
                    .then(() => {
                    resolve({ value: this.trimmedData });
                });
            });
            return parser;
        });
    }
    static writeRow(parameters) {
        return new Promise((resolve, reject) => {
            (0, log_1.logLine)("gSheet WRITE BEGIN");
            deWrite("Parameters given: ", parameters);
            gSheet.sanitizeData(parameters.data)
                .then((sanitized) => {
                deWrite("Sanitized data: ", sanitized);
                (0, log_1.logLine)("gSheet WRITE COMPLETE");
                resolve();
            });
        });
    }
    // public stream(data: gSheetRow): Promise<string> {
    //     return new Promise((resolve, reject) => {
    //         logLine("gSheet WRITE BEGIN");
    //         deWrite("Data given: ", data);
    //         gSheet.sanitizeData(data)
    //         .then((sanitized) => {
    //                 deWrite("Sanitized data: ", data);
    //                 this.writeStream.write(sanitized + "\n");
    //                 resolve(this.output);
    //             })
    //     });
    // }
    getData() {
        return this.trimmedData;
    }
    /**
     * Process each item of a given row
     * row: Row to be processed
     * eachExecution: Array of functions to be executed
     *  * Functions will be executed against each column of provided row in order
     */
    static processRow(row, eachExecution) {
        const executeRow = (cell, key) => {
            if (typeof eachExecution[key] === "function") {
                return eachExecution[key](cell, key);
            }
            else {
                (0, log_1.log)(`No function provided for column ${key}`);
                Promise.reject("Provided function is not a function...");
            }
        };
        const execute = () => {
            return asyncUtil_1.AsyncUtil.eachOfLimit(row, 3, (cell, key, callback) => {
                executeRow(cell, key)
                    .then(callback);
            });
        };
        const reject = () => {
            return Promise.reject("Provided Row and Function arrays do not match length.");
        };
        if (row.length === eachExecution.length) {
            return execute();
        }
        else {
            return reject();
        }
    }
    static getWebIdColumn(headerRow) {
        const checkCell = (input) => {
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
        const funcArray = [];
        const webIdColumn = {
            value: 0,
            headersDefined: false
        };
        const eachFunction = (currentCell, columnNumber) => {
            return new Promise((resolve) => {
                if (checkCell(currentCell)) {
                    deWebId(`WebID Located in ${columnNumber}, ${currentCell}; resolving`);
                    webIdColumn.value = columnNumber;
                    webIdColumn.headersDefined = true;
                    resolve({ value: columnNumber });
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
    connect() {
        (0, log_1.logLine)("Attempting to establish connection");
        return new Promise((resolve, reject) => {
            deConn("Reading ./credentials.json");
            fs.readFile("./credentials.json", "utf-8", (error, content) => {
                if (error) {
                    deConn("Error loading client secret file:", error);
                    reject();
                }
                else {
                    deConn("File conents loaded, authorizing");
                    this.authorize(JSON.parse(content))
                        .then((token) => {
                        deConn("Authorization Success, Connection established");
                        this.sheet = googleapis_1.google.sheets({
                            version: "v4",
                            auth: this.token
                        });
                        (0, log_1.logLine)("Google APIs Connection Established");
                        resolve();
                    });
                }
                ;
            });
        });
    }
    ;
    authorize(credentials) {
        return new Promise((resolve, reject) => {
            deAuth("Attempting to authorize");
            const client_secret = credentials.installed;
            const client_id = credentials.installed;
            const redirect_uris = credentials.installed;
            const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            deAuth("Checking for previous token");
            /* Check for stored token */
            fs.readFile(this.tokenPath, (error, token) => {
                if (error) {
                    deAuth("Token not located. Creating Token");
                    return this.getNewToken(oAuth2Client);
                }
                else if (typeof token === "string") {
                    deAuth("Token located. Setting Credentials");
                    oAuth2Client.setCredentials(JSON.parse(token));
                    this.token = oAuth2Client;
                    resolve(this.token);
                }
            });
        });
    }
    ;
    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
     */
    getNewToken(oAuth2Client) {
        return new Promise((resolve, reject) => {
            deAuth("Attempting to establish new token");
            const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
            });
            deAuth("Attempting to establish new token");
            (0, log_1.logLine)(`Authorize this app by visiting this url: ${authUrl}`);
            (0, log_1.log)(authUrl);
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            deAuth("Requesting Access");
            rl.question('Enter the code from that page here: ', (code) => {
                rl.close();
                oAuth2Client.getToken(code, (error, token) => {
                    deAuth("Generating Token");
                    if (error) {
                        deConn("Error generating token", error);
                        reject(error);
                    }
                    else {
                        deAuth("Token generation successful");
                        oAuth2Client.setCredentials(token);
                        // Store the token to disk for later program executions
                        deAuth("Caching token");
                        fs.writeFile(this.tokenPath, JSON.stringify(token), (error) => {
                            if (error) {
                                deConn("Error caching token", error);
                                reject(error);
                            }
                            ;
                            (0, log_1.log)('Token stored to', this.tokenPath);
                        });
                        this.token = oAuth2Client;
                        resolve(this.token);
                    }
                    ;
                });
            });
        });
    }
    ;
    static sanitizeData(data) {
        return new Promise((resolve, reject) => {
            const tempData = [];
            function sanitizeRow(row) {
                deSani(row);
                return row.map((currentString) => {
                    const wrapper = ["\"", "\""];
                    let temporaryString = currentString && currentString.trim();
                    if (temporaryString && temporaryString.indexOf("\"") >= 0) {
                        temporaryString = temporaryString.split("'").join("\\'");
                        temporaryString = temporaryString.split("\"").join("'");
                    }
                    else if (!temporaryString) {
                        deSani("Current String is not sanitizable");
                        deSani(temporaryString);
                        temporaryString = "";
                    }
                    return wrapper.join(temporaryString);
                });
            }
            deSani("Attempting to sanitize");
            deSani(data);
            deSani("--------------- END SANITIZE DATA ---------------");
            for (let i = data.length - 1; i >= 0; i -= 1) {
                deSani(`Sanitizing row ${i}`, data[i]);
                tempData.unshift(sanitizeRow(data[i]).join(","));
            }
            resolve(tempData.join("\n"));
        });
    }
}
exports.gSheet = gSheet;
/* Parse.begin(input, (currentRow) => {
    deBase("Executing row", currentRow);
}).then(
    deBase("Trimmed Data:", Parse.getData())
); */
//# sourceMappingURL=processGoogleSheets.js.map