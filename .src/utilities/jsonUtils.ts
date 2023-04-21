/* eslint-disable max-len */
/* Import UTILITIES */
import {dBug, debLine} from "../utilities/dBug";
import {log, logLine} from "../utilities/log";
import {FsUtils} from "../utilities/fsUtils";
import {srcPath} from "../utilities/srcPath";
import {dateStamp} from "../utilities/dateStamp";

/* Import MODULES */
import * as jsonFile from "edit-json-file";
import {anyObject, anyStandard} from "../.types";

// TODO: Refactor jsonUtils to try/catch

export interface IfsReturns {
    filePath: string;
    error: string;
    data: string;
}

export class jsonUtils {
    /**
     * Reads file defined in filePath, returns data in utf-8
     * @param filePath Path to file to be read
     */
    private workingData: IfsReturns;
    private deb: dBug;
    private editor: jsonFile.JsonEditor;
    private filePath: string;
    private fsOutput: FsUtils;

    constructor(filePath: string) {
        this.workingData = {
            filePath,
            error: null,
            data: ""
        };
        this.deb = new dBug("utilities:jsonUtils");
        this.editor = jsonFile(srcPath(this.workingData.filePath), {autosave: true});
        this.fsOutput = new FsUtils(this.workingData.filePath);
    }

    private createPath = () => {
        const deb = this.deb.set("createPath");
        logLine(`Creating JSON output: ${this.filePath}`);

        return this.fsOutput.create.json({})
            .catch((err) => {
                console.error(err);
                return Promise.reject(err);
            });

    };

    private resetPath = () => {
        const deb = this.deb.set("resetPath");
        logLine(`Resetting JSON output: ${this.filePath}`);

        return this.fsOutput.delete()
            .then(() => {
                deb(`Re-Creating JSON file at ${this.filePath}`);
                return this.createPath()
                    .then(() => {
                        return Promise.resolve();
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });

            })
            .catch((err) => {
                logLine(`Deleting ${this.filePath} Failed`);
                return Promise.reject(err);
            });
    };

    public checkPath = (reset?: boolean): Promise<void> => {
        const deb = this.deb.set("checkPath");

        return this.fsOutput
            .check()
            .then(() => {
                if (reset) {
                    return this.resetPath();
                } else {
                    return Promise.resolve();
                }
            })
            .catch((err) => {
                logLine(`${this.filePath} did not exist, creating`);
                return this.createPath()
                    .then(() => {
                        return Promise.resolve();
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            });
    };

    /** Get value from JSON file
     ** jsonPath: Object Path as string
     ** -  e.g. ("parent.child")
     ** Note: If a "." exists in a key, prefice with double slash
     ** - e.g. ("parent\\.subParent.child")
     */
    public get = (jsonPath: string): anyStandard => {
        const deb = this.deb.set("jsonUtils:get");
        deb(`Fetching JSON from ${jsonPath}`);

        return this.editor.get(jsonPath);
    };

    /** Set value from JSON file
     * jsonPath: Object Path as string
     ** e.g. ("parent.child")
     * value: Value to be saved
     */
    public set = (jsonPath: string, value: anyStandard): void => {
        const deb = this.deb.set("jsonUtils:set");
        deb(`Setting JSON at ${jsonPath}`);
        deb(value);
        
        this.editor.set(jsonPath, value);
    };
    
    /** Append to existing array in JSON file
    * jsonPath: Object Path as string
    ** e.g. ("parent.child")
    * value: Value to be saved
    */
    public append = (jsonPath: string, value: anyStandard): void => {
        const deb = this.deb.set("jsonUtils:append");
        deb(`Appending to Array at ${jsonPath}`);
        deb(value);

        this.editor.append(jsonPath, value);
    };
    public read = (): anyObject => {
        return this.editor.read() as anyObject;
    };
}

const test = () => {
    // const testUtil = new jsonUtils(`./outputs/recordScrape/${dateStamp()}recordScrape.json`);
    const testUtil = new jsonUtils("properties.i.json");
    const data = testUtil.read();

    // log(testUtil.get("2012348091"));
    
    // logLine("Setting Data");
    // testUtil.set("2012348091.NewValue", "test");

    // logLine("Appending Data");
    // testUtil.append("2012348091.wsmData.webId", "test");

    // testUtil.set("NewValue", "anotherTest");

    // logLine("Appending New Array Data");
    // testUtil.append("2012348091.wsmData.newValue", "test");

    // logLine("Appending New Key and Array Data");
    // testUtil.append("2012348091.anotherNew.newValue", "test");
    // log(testUtil.get("2012348091"));

    // const testEmpty = testUtil.get("2012348091.none");
    // if (!testEmpty) {
    //     log("None does not exist");
    // }

    log(data);
};

// test();