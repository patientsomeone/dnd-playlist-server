/* Import UTILITIES */
import { dBug, debLine } from "../utilities/dBug";
import { FsUtils, IfsReturns } from "../utilities/fsUtils";
import { objectExtend } from "../utilities/objecExtend";


const deb = new dBug("helpers:file");

export interface IgetOptions {
    autoCreate: boolean;
}

interface IfileReturn extends IfsReturns {
    exists: boolean;
    created: boolean;
}

export interface IjsonTemplate {
    [key: string]: any;
}


export class Json {
    private filePath: string;
    private file: FsUtils;
    private jsonTemplate: IjsonTemplate | any[];
    private options: IgetOptions;
    private workingData: IjsonTemplate;

    constructor(filePath: string, jsonTemplate: IjsonTemplate, options: IgetOptions) {
        this.filePath = filePath;
        this.jsonTemplate = jsonTemplate;
        this.options = options;
        this.file = new FsUtils(this.filePath);
        this.workingData = {
            exists: false,
            created: false
        };
    }

    public get = () => {
        const debGet = deb.set("json");

        debGet(debLine());
        debGet(`Checking for file ${this.filePath}`);
        this.workingData.filePath = this.filePath;

        /* Check existance of intended file */
        return this.file.check()
            .then((data) => {
                /* Read file */
                debGet("File check succeeded");
                return this.file.read.raw()
                .then((readData) => {
                    const jsonContents = JSON.parse(readData.data);
                    debGet("File contents read");
                    debGet(jsonContents);
                    return Promise.resolve(jsonContents);
                });
            }, (err) => {
                /* Create file */
                debGet(`File Not located. AutoCreate set to ${this.options.autoCreate}. | ${this.options.autoCreate ? "Creating file" : "Stopping"}`);
                this.workingData.exists = false;
                
                if (!this.options.autoCreate) {
                    debGet("File creation declined");
                    return Promise.reject(this.workingData);
                }
                
                debGet("Attempting file creation");
                return this.file.create.json(this.jsonTemplate)
                .then((result) => {
                        debGet("File creation successful");
                        debGet(result);
                        this.workingData.created = true;
                        this.workingData.error = result.error;
                        this.workingData.data = result.data;
                        return Promise.reject(this.workingData);
                    }, (err) => {
                        debGet("File creation failed");
                        debGet(err);
                        this.workingData.data = err.data;
                        this.workingData.error = err.error;
                        return Promise.reject(this.workingData);
                    });
            });
    }
}
