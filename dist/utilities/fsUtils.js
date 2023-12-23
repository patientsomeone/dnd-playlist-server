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
exports.FsUtils = void 0;
const dBug_1 = require("../utilities/dBug");
const log_1 = require("../utilities/log");
const objecExtend_1 = require("../utilities/objecExtend");
/* Import MODULES */
const fs = __importStar(require("fs"));
const JSONStream = __importStar(require("JSONStream"));
const deb = new dBug_1.dBug("utilities:fsUtils");
class FsUtils {
    constructor(filePath) {
        /**
         * Reads file defined in filePath, returns data in utf-8
         * @param filePath Path to file to be read
         */
        this.read = {
            raw: () => {
                return new Promise((resolve, reject) => {
                    const debRead = deb.set("read:raw");
                    debRead((0, dBug_1.debLine)("CURRENT WORKING DATA"));
                    debRead(this.workingData);
                    fs.readFile(this.workingData.filePath, "utf-8", (error, data) => {
                        if (!error) {
                            debRead((0, dBug_1.debLine)(`FILE READ SUCCESS`));
                            this.workingData.data = data;
                            this.workingData.error = error;
                            resolve(this.workingData);
                        }
                        else {
                            debRead((0, dBug_1.debLine)(`FILE READ ERROR`));
                            this.workingData.data = data;
                            this.workingData.error = error;
                            reject(this.workingData);
                        }
                    });
                });
            },
            properties: (defaultProperties) => {
                const deb = this.deb.set("read:properties");
                return this.check()
                    .then(this.read.raw)
                    .catch((error) => {
                    deb("No Properties file located. Creating");
                    return this.create.json(defaultProperties)
                        .then(() => {
                        return Promise.resolve(defaultProperties);
                    });
                })
                    .then((result) => {
                    deb("Properties File available");
                    deb("File Results");
                    deb(result);
                    // @ts-ignore
                    const data = JSON.parse(result.data);
                    deb("Data Parsed");
                    deb(data);
                    const newData = (0, objecExtend_1.objectExtend)(defaultProperties, data);
                    this.create.json(newData);
                    return Promise.resolve(newData);
                });
            },
            jsonStream: (iterator) => {
                return new Promise((resolve, reject) => {
                    const debRead = deb.set("read:jsonStream");
                    debRead((0, dBug_1.debLine)("CURRENT WORKING DATA"));
                    debRead(this.workingData);
                    const readStream = fs.createReadStream(this.workingData.filePath);
                    const parser = JSONStream.parse();
                    readStream.pipe(parser);
                    parser.on("data", iterator);
                    // parser.on("data", (data) => {
                    //     log(`key: ${data.key}`);
                    //     log(`value: ${data.value}`);
                    // });
                    parser.on("end", () => {
                        Promise.resolve();
                    });
                    fs.readFile(this.workingData.filePath, "utf-8", (error, data) => {
                        if (!error) {
                            debRead((0, dBug_1.debLine)(`FILE READ SUCCESS`));
                            this.workingData.data = data;
                            this.workingData.error = error;
                            resolve(this.workingData);
                        }
                        else {
                            debRead((0, dBug_1.debLine)(`FILE READ ERROR`));
                            this.workingData.data = data;
                            this.workingData.error = error;
                            reject(this.workingData);
                        }
                    });
                });
            }
        };
        // public stream = (onChunk: (chunk: any) => void) => {
        //     return new Promise((resolve, reject) => {
        //         const debStream = deb.set("stream");
        //         const stream = fs.createReadStream(this.workingData.filePath, "utf-8");
        //         stream.on("ready", (data) => {
        //             debStream("Stream open. Processesing...");
        //             debStream(data);
        //         });
        //         stream.on("data", (chunk) => {
        //             debStream(chunk);
        //             if (typeof onChunk === "function") {
        //                 onChunk(chunk);
        //             }
        //         });
        //         stream.on("end", (data) => {
        //             debStream(data);
        //             resolve();
        //         });
        //         return
        //     })
        // }
        this.create = {
            json: (input) => {
                const debCreate = deb.set("create:json");
                debCreate((0, dBug_1.debLine)("CURRENT WORKING DATA"));
                debCreate(this.workingData);
                return new Promise((resolve, reject) => {
                    const json = JSON.stringify(input);
                    this.workingData.data = json;
                    debCreate(`Attempting to create JSON File at ${this.workingData.filePath}`);
                    debCreate(json);
                    fs.writeFile(this.workingData.filePath, json, "utf-8", (error) => {
                        if (!error) {
                            this.workingData.error = error;
                            debCreate(`File write complete`);
                            resolve(this.workingData);
                        }
                        else {
                            this.workingData.error = error;
                            debCreate((0, dBug_1.debLine)(`WRITE ERROR ENCOUNTERED`));
                            debCreate(error);
                            reject(this.workingData);
                        }
                    });
                });
            },
            raw: (input) => {
                const debCreate = deb.set("create:raw");
                debCreate((0, dBug_1.debLine)("CURRENT WORKING DATA"));
                debCreate(this.workingData);
                return new Promise((resolve, reject) => {
                    this.workingData.data = input;
                    debCreate(`Attempting to create JSON File at ${this.workingData.filePath}`);
                    debCreate(input);
                    fs.writeFile(this.workingData.filePath, input, "utf-8", (error) => {
                        if (!error) {
                            this.workingData.error = error;
                            debCreate(`File write complete`);
                            resolve(this.workingData);
                        }
                        else {
                            this.workingData.error = error;
                            debCreate((0, dBug_1.debLine)(`WRITE ERROR ENCOUNTERED`));
                            debCreate(error);
                            reject(this.workingData);
                        }
                    });
                });
            }
        };
        this.writeStream = {
            json: (input) => {
                const debCreate = deb.set("create:json");
                debCreate((0, dBug_1.debLine)("CURRENT WORKING DATA"));
                debCreate(this.workingData);
                return new Promise((resolve, reject) => {
                    const json = JSON.stringify(input);
                    this.workingData.data = json;
                    this.wStream = fs.createWriteStream(this.workingData.filePath);
                    debCreate(`Attempting to create JSON File at ${this.workingData.filePath}`);
                    debCreate(json);
                    this.wStream.write(json, "utf-8", (error) => {
                        if (!error) {
                            this.workingData.error = error;
                            debCreate(`File write complete`);
                            resolve(this.workingData);
                        }
                        else {
                            this.workingData.error = error;
                            debCreate((0, dBug_1.debLine)(`WRITE ERROR ENCOUNTERED`));
                            debCreate(error);
                            reject(this.workingData);
                        }
                    });
                });
            }
        };
        this.check = () => {
            return new Promise((resolve, reject) => {
                const debCheck = deb.set("checkFile");
                debCheck((0, dBug_1.debLine)("CURRENT WORKING DATA"));
                debCheck(this.workingData);
                fs.access(this.workingData.filePath, fs.constants.F_OK, (error) => {
                    if (!error) {
                        debCheck(`${this.workingData.filePath} exists.`);
                        this.workingData.error = error;
                        resolve(this.workingData);
                    }
                    else {
                        (0, log_1.logLine)(`${this.workingData.filePath} does not exist.`);
                        this.workingData.error = error;
                        reject(this.workingData);
                    }
                });
            });
        };
        this.delete = () => {
            return new Promise((resolve, reject) => {
                fs.unlink(this.workingData.filePath, (err) => {
                    if (!err) {
                        resolve("success");
                    }
                    else {
                        reject(err);
                    }
                });
            });
        };
        this.workingData = {
            filePath,
            error: null,
            data: null
        };
        this.deb = new dBug_1.dBug("utilities:fsUtils");
    }
}
exports.FsUtils = FsUtils;
//# sourceMappingURL=fsUtils.js.map