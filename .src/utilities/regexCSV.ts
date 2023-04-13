import * as async from "async";
import * as parseCsv from "csv-parse";
import * as debug from "debug";
import * as fs from "fs";
import * as performance from "performance";

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

export class Parse {
    public begin(inputFile): any {
        const trimData = [];
        let totalLines = 0;
        const parser = parseCsv({delimiter: ","}, (err, data) => {
                async.eachSeries(data, (line, callback) => {
                    const trimRow = [];
                    const lineLength = line.length;
                    let rowMatch = false;
                    let matchedData;

                    totalLines ++;

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
log("Beginning");
