"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Json = void 0;
/* Import UTILITIES */
const dBug_1 = require("../utilities/dBug");
const fsUtils_1 = require("../utilities/fsUtils");
const deb = new dBug_1.dBug("helpers:file");
class Json {
    constructor(filePath, jsonTemplate, options) {
        this.get = () => {
            const debGet = deb.set("json");
            debGet((0, dBug_1.debLine)());
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
        };
        this.filePath = filePath;
        this.jsonTemplate = jsonTemplate;
        this.options = options;
        this.file = new fsUtils_1.FsUtils(this.filePath);
        this.workingData = {
            exists: false,
            created: false
        };
    }
}
exports.Json = Json;
//# sourceMappingURL=file.js.map