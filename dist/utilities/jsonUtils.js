"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonUtils = void 0;
/* eslint-disable max-len */
/* Import UTILITIES */
const dBug_1 = require("../utilities/dBug");
const log_1 = require("../utilities/log");
const fsUtils_1 = require("../utilities/fsUtils");
const srcPath_1 = require("../utilities/srcPath");
/* Import MODULES */
const edit_json_file_1 = __importDefault(require("edit-json-file"));
class jsonUtils {
    constructor(filePath) {
        this.createPath = () => {
            const deb = this.deb.set("createPath");
            (0, log_1.logLine)(`Creating JSON output: ${this.filePath}`);
            return this.fsOutput.create.json({})
                .catch((err) => {
                console.error(err);
                return Promise.reject(err);
            });
        };
        this.resetPath = () => {
            const deb = this.deb.set("resetPath");
            (0, log_1.logLine)(`Resetting JSON output: ${this.filePath}`);
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
                (0, log_1.logLine)(`Deleting ${this.filePath} Failed`);
                return Promise.reject(err);
            });
        };
        this.viewPath = () => __awaiter(this, void 0, void 0, function* () {
            return this.filePath;
        });
        this.checkPath = (reset) => {
            const deb = this.deb.set("checkPath");
            return this.fsOutput
                .check()
                .then(() => __awaiter(this, void 0, void 0, function* () {
                if (!!reset) {
                    return yield this.resetPath();
                }
                else {
                    return Promise.resolve();
                }
            }))
                .catch((err) => {
                (0, log_1.logLine)(`${this.filePath} did not exist, creating`);
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
        this.get = (jsonPath) => {
            const deb = this.deb.set("jsonUtils:get");
            deb(`Fetching JSON from ${jsonPath}`);
            return this.editor.get(jsonPath);
        };
        /** Set value from JSON file
         * jsonPath: Object Path as string
         ** e.g. ("parent.child")
         * value: Value to be saved
         */
        this.set = (jsonPath, value) => {
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
        this.append = (jsonPath, value) => {
            const deb = this.deb.set("jsonUtils:append");
            deb(`Appending to Array at ${jsonPath}`);
            deb(value);
            this.editor.append(jsonPath, value);
        };
        this.read = () => {
            // console.log(`Returning Data from ${this.filePath}`);
            return this.editor.read();
        };
        this.workingData = {
            filePath,
            error: null,
            data: ""
        };
        this.filePath = (0, srcPath_1.srcPath)(this.workingData.filePath);
        this.deb = new dBug_1.dBug("utilities:jsonUtils");
        this.editor = (0, edit_json_file_1.default)(this.filePath, { autosave: true });
        this.fsOutput = new fsUtils_1.FsUtils(this.workingData.filePath);
    }
}
exports.jsonUtils = jsonUtils;
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
    (0, log_1.log)(data);
};
// test();
//# sourceMappingURL=jsonUtils.js.map