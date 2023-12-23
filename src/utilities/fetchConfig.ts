/* UTILITIES */
import {dBug, debLine} from "./dBug";
import {objectExtend} from "./objecExtend";
import {AsyncUtil} from "./asyncUtil";
import {jsonUtils} from "./jsonUtils";
import {anyStandard} from "../.types";

const moduleTest = false;

const dBugger = new dBug("utilities:fetchConfig");

interface Iconfig {
    [key: string]: anyStandard;
}

export class Config {
    private config: Iconfig;
    private json: jsonUtils;

    private defaultConfig: Iconfig;
    private deb: dBug;
    private configPath = "./json/.config.json";

    constructor(defaultConfig: Iconfig) {
        this.config = {};
        this.defaultConfig = defaultConfig;
        this.json = new jsonUtils(this.configPath);
        this.deb = dBugger.append();
    }

    public fetch = async (): Promise<Iconfig> => {
        const deb = this.deb.append();

        deb.call(`Fetching ${this.configPath}`);
        try {
            await AsyncUtil.eachOfSeries(this.defaultConfig, (individualConfig, key: string | number, triggerNext: () => void) => {
                const saniKey = typeof key === "string" ? key.split(".").join("\\.") : key.toString();
                const property = this.json.get(saniKey);

                if (typeof individualConfig === "object") {
                    this.config[key] = objectExtend(individualConfig, property);
                } else {
                    this.config[key] = property || individualConfig;
                }

                this.json.set(saniKey, this.config[key]);
                triggerNext();
            });
            deb.call(`Retrieved ${this.configPath}`);
            
            deb.call(this.config.toString());

            return this.config;
        } catch (err) {
            throw(err);
        };
    };
}

const testFetchConfig = async () => {
    const testConfig = new Config({
        baseUrls: {
            hydraGraph: {
                prod: "https://hydra-services.prod-cfp-pdx.sincrod.com/hydra-graph/route/"
            }
        }
    });

    return await testConfig.fetch();
};

if (moduleTest) {
    testFetchConfig()
        .catch((err) => {
            dBugger.call()("Test Failed");
            dBugger.call()(err);
            console.error(err);
        });
};