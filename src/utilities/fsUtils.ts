/* Import UTILITIES */
import {AsyncUtil} from "../utilities/asyncUtil";
import {dBug, debLine} from "../utilities/dBug";
import {log, logLine} from "../utilities/log";
import { objectExtend } from "../utilities/objecExtend";

/* Import MODULES */
import * as fs from "fs";
import * as JSONStream from "JSONStream";
import {dateStamp} from "./dateStamp";
import {anyObject, anyStandard} from "../.types";

const deb = new dBug("utilities:fsUtils");

export type IfsReturns = {
    filePath: string;
    error: any;
    data: string;
};

export class FsUtils {

    /**
     * Reads file defined in filePath, returns data in utf-8
     * @param filePath Path to file to be read
     */
    public read = {
            raw: (): Promise<IfsReturns> => {
                return new Promise((resolve, reject) => {
                    const debRead = deb.set("read:raw");
                    
                    debRead(debLine("CURRENT WORKING DATA"));
                    debRead(this.workingData);
                    
                    fs.readFile(this.workingData.filePath, "utf-8", (error, data) => {
                        if (!error) {
                            debRead(debLine("FILE READ SUCCESS"));
                            this.workingData.data = data;
                            this.workingData.error = error;
                            resolve(this.workingData);
                        } else {
                            debRead(debLine("FILE READ ERROR"));
                            this.workingData.data = data;
                            this.workingData.error = error;
                            reject(this.workingData);
                        }
                    });
                });
            },
            properties: (defaultProperties: {[key: string]: anyStandard;}): Promise<anyObject> => {
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
                    .then(async (result) => {
                        deb("Properties File available");
                        deb("File Results");
                        deb(result);
                        const data = JSON.parse(result.data as string) as {[key: string]: anyStandard;};
                        deb("Data Parsed");
                        deb(data);

                        const newData = objectExtend(defaultProperties, data) as {[key: string]: anyObject;};

                        try {
                            await this.create.json(newData);
                            return Promise.resolve(newData);
                        } catch (error) {
                            return Promise.reject(error);
                        }

                    });
            },
            jsonStream: (iterator: (individualItem: string | number | boolean | { [key: string]: any | any[];}) => void ): Promise<IfsReturns> => {
                return new Promise((resolve, reject) => {
                    const debRead = deb.set("read:jsonStream");
                    
                    debRead(debLine("CURRENT WORKING DATA"));
                    debRead(this.workingData);

                    const readStream = fs.createReadStream(this.workingData.filePath);
                    const parser = JSONStream.parse();

                    readStream.pipe(parser);

                    parser.on("data", iterator);
                    // parser.on("data", (data) => {
                    //     log(`key: ${data.key}`);
                    //     log(`value: ${data.value}`);
                    // });
                    
                    parser.on("end", async () => {
                        await Promise.resolve();
                    });



                    fs.readFile(this.workingData.filePath, "utf-8", (error, data) => {
                        if (!error) {
                            debRead(debLine("FILE READ SUCCESS"));
                            this.workingData.data = data;
                            this.workingData.error = error;
                            resolve(this.workingData);
                        } else {
                            debRead(debLine("FILE READ ERROR"));
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


    public create = {
        json: (input: { [key: string]: any; } | any[]): Promise<IfsReturns> => {
            const debCreate = deb.set("create:json");

            debCreate(debLine("CURRENT WORKING DATA"));
            debCreate(this.workingData);

            
            return new Promise((resolve, reject) => {
                const json = JSON.stringify(input);
                this.workingData.data = json;

                debCreate(`Attempting to create JSON File at ${this.workingData.filePath}`);
                debCreate(json);
                fs.writeFile(this.workingData.filePath, json, "utf-8", (error) => {
                    if (!error) {
                        this.workingData.error = error;
                        debCreate("File write complete");
                        resolve(this.workingData);
                    } else {
                        this.workingData.error = error;
                        debCreate(debLine("WRITE ERROR ENCOUNTERED"));
                        debCreate(error);
                        reject(this.workingData);
                    }
                });
            });
        },
        raw: (input: string): Promise<IfsReturns> => {
            const debCreate = deb.set("create:raw");

            debCreate(debLine("CURRENT WORKING DATA"));
            debCreate(this.workingData);

            
            return new Promise((resolve, reject) => {
                this.workingData.data = input;

                debCreate(`Attempting to create JSON File at ${this.workingData.filePath}`);
                debCreate(input);
                fs.writeFile(this.workingData.filePath, input, "utf-8", (error) => {
                    if (!error) {
                        this.workingData.error = error;
                        debCreate("File write complete");
                        resolve(this.workingData);
                    } else {
                        this.workingData.error = error;
                        debCreate(debLine("WRITE ERROR ENCOUNTERED"));
                        debCreate(error);
                        reject(this.workingData);
                    }
                });
            });
        }
    };

    public writeStream = {
        initialize: async (): Promise<IfsReturns> => {
            const debCreate = deb.set("writeStream:initialize");

            debCreate(debLine("CURRENT WORKING DATA"));
            debCreate(this.workingData);

            await this.check()
                .catch(async (err) => {
                    debCreate(`Attempting to create file at ${this.workingData.filePath}`);
                    await this.create.raw(`${Date.now().toLocaleString()}: File Created`);
                });

            if (!this.wStream) {
                this.wStream = fs.createWriteStream(this.workingData.filePath, {flags: "a"});
                return this.workingData;
            }

            log(`Write Stream exists for ${this.workingData.filePath}`);
            return this.workingData;

        },
        json: (input: { [key: string]: any; } | any[]): Promise<IfsReturns> => {
            const debCreate = deb.set("writeStream:json");

            debCreate(debLine("CURRENT WORKING DATA"));
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
                        debCreate("File write complete");
                        resolve(this.workingData);
                    } else {
                        this.workingData.error = error;
                        debCreate(debLine("WRITE ERROR ENCOUNTERED"));
                        debCreate(error);
                        reject(this.workingData);
                    }
                });
            });
        },
        raw: async (input: string): Promise<IfsReturns> => {
            const debCreate = deb.set("writeStream:raw");

            debCreate(debLine("CURRENT WORKING DATA"));
            debCreate(this.workingData);

            return new Promise((resolve, reject) => {
                if (!this.wStream) {
                    (async () => {
                        try {
                            await this.writeStream.initialize();
                        } catch (error) {
                            throw(error);
                        }
                    })();
                }

                this.wStream.write(input, "utf-8", (error) => {
                    if (!error) {
                        this.workingData.error = error;
                        debCreate("File write complete");
                        resolve(this.workingData);
                    } else {
                        this.workingData.error = error;
                        debCreate(debLine("WRITE ERROR ENCOUNTERED"));
                        debCreate(error);
                        reject(this.workingData);
                    }
                });
            });
        }
    };

    public logFile = async (msg: string, err?: boolean): Promise<void> => {
        const debLog = deb.set("logFile");
        const timeStamp = new Date(Date.now()).toLocaleString();
        const status = !err ? "Log" : "";
        const wMsg = `${status} [${timeStamp}]: ${msg}\n`;
        
        try {
            debLog(`Writing ${wMsg}`);
            if (!!err) {
                await this.writeStream.raw("\n----------------------------------\\\n");
                await this.writeStream.raw("--\\-- ERROR --\\--                  \\\n");
            }

            await this.writeStream.raw(wMsg);
            
            if (!!err) {
                await this.writeStream.raw("--/-- ERROR --/--                  /\n");
                await this.writeStream.raw("----------------------------------/\n\n");
            }
            return;
        } catch (error) {
            debLog(`Failed to write ${wMsg}`);
        }

    };
    
    private workingData: IfsReturns;
    private deb: dBug;

    private wStream: fs.WriteStream;
    constructor(filePath: string) {
        this.workingData = {
            filePath,
            error: null,
            data: null
        };
        this.deb = new dBug("utilities:fsUtils");
    }

    public check = (): Promise<IfsReturns> => {
        return new Promise((resolve, reject) => {
            const debCheck = deb.set("checkFile");

            debCheck(debLine("CURRENT WORKING DATA"));
            debCheck(this.workingData);

            fs.access(this.workingData.filePath, fs.constants.F_OK, (error) => {
                if (!error) {
                    debCheck(`${this.workingData.filePath} exists.`);
                    this.workingData.error = error;
                    resolve(this.workingData);
                } else {
                    logLine(`${this.workingData.filePath} does not exist.`);
                    this.workingData.error = error;
                    reject(this.workingData);
                }
            });
        });
    };

    public delete = () => {
        return new Promise((resolve, reject) => {
            fs.unlink(this.workingData.filePath, (err) => {
                if (!err) {
                    resolve("success");
                } else {
                    reject(err);
                }
            });

        });
    };
}

const test = () => {
    const logger = new FsUtils(`./logs/${dateStamp()}_log.txt`);
    log("Test Entry 1");
    log("Test Entry 2");
    log("Test Error 1", true);
    log("Test Entry 3");
    log("Test Error 2", true);
    log("Test Entry 4");
};

// test();