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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
/* UTILITIES */
const dBug_1 = require("./dBug");
const objecExtend_1 = require("./objecExtend");
const asyncUtil_1 = require("./asyncUtil");
const jsonUtils_1 = require("./jsonUtils");
const moduleTest = false;
const dBugger = new dBug_1.dBug("utilities:fetchConfig");
class Config {
    constructor(defaultConfig) {
        this.configPath = "./json/.config.json";
        this.fetch = () => __awaiter(this, void 0, void 0, function* () {
            const deb = this.deb.append();
            deb.call(`Fetching ${this.configPath}`);
            try {
                yield asyncUtil_1.AsyncUtil.eachOfSeries(this.defaultConfig, (individualConfig, key, triggerNext) => {
                    const saniKey = typeof key === "string" ? key.split(".").join("\\.") : key.toString();
                    const property = this.json.get(saniKey);
                    if (typeof individualConfig === "object") {
                        this.config[key] = (0, objecExtend_1.objectExtend)(individualConfig, property);
                    }
                    else {
                        this.config[key] = property || individualConfig;
                    }
                    this.json.set(saniKey, this.config[key]);
                    triggerNext();
                });
                deb.call(`Retrieved ${this.configPath}`);
                deb.call(this.config.toString());
                return this.config;
            }
            catch (err) {
                throw (err);
            }
        });
        this.config = {};
        this.defaultConfig = defaultConfig;
        this.json = new jsonUtils_1.jsonUtils(this.configPath);
        this.deb = dBugger.append();
    }
}
exports.Config = Config;
const testFetchConfig = () => __awaiter(void 0, void 0, void 0, function* () {
    const testConfig = new Config({
        baseUrls: {
            hydraGraph: {
                prod: "https://hydra-services.prod-cfp-pdx.sincrod.com/hydra-graph/route/"
            }
        }
    });
    return yield testConfig.fetch();
});
if (moduleTest) {
    testFetchConfig()
        .catch((err) => {
        dBugger.call()("Test Failed");
        dBugger.call()(err);
        console.error(err);
    });
}
//# sourceMappingURL=fetchConfig.js.map