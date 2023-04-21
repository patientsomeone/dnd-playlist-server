/* UTILITIES */
import {anyStandard, anyObject} from "../.types";
import {dBug, debLine} from "../utilities/dBug";
import {FsUtils} from "../utilities/fsUtils";
import {log, logLine} from "../utilities/log";
import {objectExtend} from "../utilities/objecExtend";
import {srcPath} from "../utilities/srcPath";
import {AsyncUtil} from "./asyncUtil";
import {jsonUtils} from "./jsonUtils";

const dBugger = new dBug("utilities:fetchProperties");
const testModule = false;


interface Iproperties {
    [key: string]: any;
}

export class Properties {
    private properties: Iproperties;
    private json: jsonUtils;

    private defaultProperties: Iproperties;

    constructor(defaultProperties: Iproperties) {
        this.properties = {};
        this.defaultProperties = defaultProperties;
        this.json = new jsonUtils("./.json/properties.i.json");
    }

    public fetch = async (): Promise<Iproperties> => {
        const debFetch = dBugger.set("Properties:fetch");

        try {
            await AsyncUtil.eachOfSeries(this.defaultProperties, (individualProperty, key: string, triggerNext: () => void) => {
                const saniKey = key.split(".").join("\\.");
                const property = this.json.get(saniKey);

                this.properties[key] = typeof property === "string" ? property : objectExtend(individualProperty, property);

                this.json.set(saniKey, this.properties[key]);
                triggerNext();
            });

            return this.properties;
        } catch (err) {
            throw(err);
        };
    };
}

const test = async () => {
    const testProps = new Properties({
        test: "tested",
        marchexProcessor: {
            callsReport: "./inputs/marchex/uiData.csv"
        },
        anotherTest: {
            successA: true,
            successB: true
        },
        arrayTest: ["t1","t2", "t3"]
    });

    return await testProps.fetch();

};

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
};