import {jsonUtils} from "./jsonUtils";
import {FsUtils} from "./fsUtils";
import {anyObject} from "../.types";

const filePath = "./test_inputs/jsonUtil.json";
const json = new jsonUtils(filePath);
const fs = new FsUtils(filePath);

const mockData = {
    jestMock: {
        "jest": true
    }
};

test(`${filePath} should not initially exist`, async () => {
    expect.assertions(1);
    await expect(fs.check()).rejects.toThrow("ENOENT");
});

test(`${filePath} was created by jsonUtils`, async () => {
    // Define number of assertions called
    expect.assertions(1);
    json.set("mockData", mockData);

    return await expect(json.checkPath()).resolves.not.toThrow();
});

test(`${filePath} file should match mockData`, () => {
    const jsonData = json.read();
    expect(jsonData).toEqual({mockData});
});

test("Data.jestMock.jest should match mockData.jestMock.jest", () => {
    const jsonData = json.get("mockData.jestMock") as anyObject;
    expect(jsonData).toEqual(mockData.jestMock);
});

test("JSON File should reset to empty object", async () => {
    await json.checkPath(true);
    const jsonData = json.read();
    expect(jsonData).toEqual({});
    return await fs.delete();
});