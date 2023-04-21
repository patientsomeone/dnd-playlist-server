import {jsonUtils} from "./jsonUtils";
import {Config} from "./fetchConfig";
import {FsUtils} from "./fsUtils";

const testConfig = {
    configTestOne: "tested",
    configTestTwo: {
        twoString: "tested2"
    }
};
const configPath = "./.config.json";

const json = new jsonUtils(configPath);
const jsonBak = json.read();
const jsonReset = new FsUtils(configPath);

test(`testConfig does not initially exist in ${configPath}`, () => {
    const currentData = json.get("configTest");
    expect(currentData).toBe(undefined);
});

const config = new Config(testConfig);

test(`testConfig is added to ${configPath}`, async () => {
    const currentData = await config.fetch();
    expect(currentData).toEqual(testConfig);
    return await jsonReset.delete()
        .then(() => {
            return jsonReset.create.json(jsonBak);
        })
        .catch((err) => {
            return Promise.reject(err);
        });
});