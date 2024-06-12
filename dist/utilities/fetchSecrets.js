"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Secrets = void 0;
const dBug_1 = require("../utilities/dBug");
const fsUtils_1 = require("../utilities/fsUtils");
const log_1 = require("../utilities/log");
const objecExtend_1 = require("../utilities/objecExtend");
const srcPath_1 = require("../utilities/srcPath");
const debg = new dBug_1.dBug("utilities:fetchSecrets");
class Secrets {
    constructor(intendedSecrets) {
        this.fetch = () => {
            const fs = new fsUtils_1.FsUtils((0, srcPath_1.srcPath)("secrets.i.json"));
            const debFetch = debg.set("Secrets:fetch");
            debFetch("Fetching Secrets");
            return fs.read.properties(this.intendedSecrets)
                .then((props) => {
                debFetch("Secrets Received");
                debFetch(props);
                this.secrets = (0, objecExtend_1.objectExtend)(this.intendedSecrets, props);
                debFetch("Secrets Set");
                debFetch(this.secrets);
                return Promise.resolve(this.secrets);
            })
                .catch((err) => {
                debFetch("Something went wrong");
                debFetch(err);
                return Promise.reject(err);
            });
        };
        this.secrets = {};
        this.intendedSecrets = intendedSecrets;
    }
}
exports.Secrets = Secrets;
const test = () => {
    const testProps = new Secrets({
        test: "tested",
        anotherTest: {
            successA: true,
            successB: true
        }
    });
    (0, log_1.log)(testProps.fetch());
};
// test();
//# sourceMappingURL=fetchSecrets.js.map