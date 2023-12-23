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
exports.Parse = void 0;
const async = __importStar(require("async"));
const parseCsv = __importStar(require("csv-parse"));
const debug = __importStar(require("debug"));
const fs = __importStar(require("fs"));
/*-- Define input file --*/
const input = "./input.csv";
/*-- Define output file --*/
const output = "./output.csv";
/*-- Define Regex to apply --*/
const exp = new RegExp("\(http\\:\)\(.*\)\(\\.com\|\\.net\|\\\\)", "g");
/*-- Define Column to check against --*/
const checkCol = 4;
const log = debug("log:csv:parse*");
const deCsv = debug("csv");
deCsv("Beginning CSV");
class Parse {
    begin(inputFile) {
        const trimData = [];
        let totalLines = 0;
        const parser = parseCsv({ delimiter: "," }, (err, data) => {
            async.eachSeries(data, (line, callback) => {
                const trimRow = [];
                const lineLength = line.length;
                let rowMatch = false;
                let matchedData;
                totalLines++;
                for (let i = lineLength - 1; i >= 0; i -= 1) {
                    if (i === checkCol - 1) {
                        rowMatch = exp.test(line[i]);
                        if (rowMatch) {
                            matchedData = line[i].match(exp);
                            log("Row", totalLines, "Matched:", matchedData);
                        }
                        log("Row", totalLines, "| Expression match", rowMatch);
                    }
                    trimRow.unshift(line[i].trim());
                }
                log("trimRow", trimRow);
                if (rowMatch) {
                    trimData.push(trimRow);
                }
                callback();
            }, () => {
                log("=============================");
                log("[COMPLETE] trimData", trimData);
                return trimData;
            });
        });
        fs.createReadStream(inputFile).pipe(parser);
    }
}
exports.Parse = Parse;
log("Beginning");
//# sourceMappingURL=regexCSV.js.map