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
exports.Properties = void 0;
const dBug_1 = require("../utilities/dBug");
const objecExtend_1 = require("../utilities/objecExtend");
const asyncUtil_1 = require("./asyncUtil");
const jsonUtils_1 = require("./jsonUtils");
const dBugger = new dBug_1.dBug("utilities:fetchProperties");
const testModule = false;
class Properties {
    constructor(defaultProperties) {
        this.fetch = () => __awaiter(this, void 0, void 0, function* () {
            const debFetch = dBugger.set("Properties:fetch");
            try {
                yield asyncUtil_1.AsyncUtil.eachOfSeries(this.defaultProperties, (individualProperty, key, triggerNext) => {
                    const saniKey = key.split(".").join("\\.");
                    const property = this.json.get(saniKey);
                    this.properties[key] = typeof property === "string" ? property : (0, objecExtend_1.objectExtend)(individualProperty, property);
                    this.json.set(saniKey, this.properties[key]);
                    triggerNext();
                });
                return this.properties;
            }
            catch (err) {
                throw (err);
            }
            ;
        });
        this.properties = {};
        this.defaultProperties = defaultProperties;
        this.json = new jsonUtils_1.jsonUtils("./.json/properties.i.json");
    }
}
exports.Properties = Properties;
const test = () => __awaiter(void 0, void 0, void 0, function* () {
    const testProps = new Properties({
        test: "tested",
        marchexProcessor: {
            callsReport: "./inputs/marchex/uiData.csv"
        },
        anotherTest: {
            successA: true,
            successB: true
        },
        arrayTest: ["t1", "t2", "t3"]
    });
    return yield testProps.fetch();
});
// test();
if (testModule) {
    process.on("unhandledRejection", (reason, p) => {
        dBugger.call()("Unhandled Rejection at: Promise", p, "reason:", reason);
        // application specific logging, throwing an error, or other logic here
    });
    test()
        .catch((err) => {
        dBugger.call()("Test Failed");
        dBugger.call()(err);
        console.error(err);
    });
}
;
//# sourceMappingURL=fetchProperties.js.map