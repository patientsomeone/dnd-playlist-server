import {queryProcessor} from "../src/utilities/queryProcessor";
import {fetchEnv} from "../src/utilities/fetchEnv";

jest.mock("../src/utilities/log", () => ({log: jest.fn()}));
jest.mock("../src/utilities/fetchEnv", () => ({fetchEnv: jest.fn()}));

describe("playlist query defaults and supported inputs", () => {
    beforeEach(() => jest.mocked(fetchEnv).mockResolvedValue("UC_fixture_default"));

    test("uses the configured channel and channel-wide mode by default", async () => {
        await expect(queryProcessor({})).resolves.toEqual({channelId: "UC_fixture_default", singlePlaylist: false});
        expect(fetchEnv).toHaveBeenCalledWith("YT_LIST_OWNER");
    });

    test("preserves channel casing and does not require a default for explicit channels", async () => {
        await expect(queryProcessor({channelId: "UC_AbCd-123"})).resolves.toEqual({channelId: "UC_AbCd-123", singlePlaylist: false});
        expect(fetchEnv).not.toHaveBeenCalled();
    });

    test.each([["true", true], ["TRUE", true], ["false", false], ["FaLsE", false]])(
        "parses singlePlaylist=%s as %s", async (value, expected) => {
            await expect(queryProcessor({singlePlaylist: String(value)})).resolves.toMatchObject({singlePlaylist: expected});
        }
    );

    test("ignores unsupported query keys without mutating the input", async () => {
        const query = {channelId: "UC_fixture", ignored: "value"};
        await expect(queryProcessor(query)).resolves.toEqual({channelId: "UC_fixture", singlePlaylist: false});
        expect(query).toEqual({channelId: "UC_fixture", ignored: "value"});
    });

    test("propagates missing default configuration", async () => {
        jest.mocked(fetchEnv).mockRejectedValueOnce(new Error("Missing YT_LIST_OWNER"));
        await expect(queryProcessor({})).rejects.toThrow("Missing YT_LIST_OWNER");
    });

    test.each([["UC_one", "UC_two"], {nested: "UC_one"}, "../outside", ""].map((value) => [value]))(
        "rejects invalid channel values before storage or YouTube initialization: %j", async (value) => {
            await expect(queryProcessor({channelId: value})).rejects.toMatchObject({status: 400});
        }
    );
    test.each(["yes", "", ["true", "false"], {nested: "true"}].map((value) => [value]))(
        "rejects invalid singlePlaylist values: %j", async (value) => {
            await expect(queryProcessor({singlePlaylist: value})).rejects.toMatchObject({status: 400});
        }
    );
});
