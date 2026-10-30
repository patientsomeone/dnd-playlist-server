import {dipsProcessor} from "../src/agents/dipsListProcessor";
import {processPlaylists} from "../src/utilities/processPlaylists";
import type {playlistData} from "../src/utilities/processPlaylists";
import channelResponse from "./fixtures/channel-playlists.json";
import expectedPlaylists from "./fixtures/expected-playlists.json";

// The real logger loads .i.env. Keep this suite independent of local configuration.
jest.mock("../src/utilities/log", () => ({
    log: jest.fn(),
    err: jest.fn()
}));

describe("legacy playlist naming and filtering", () => {
    test.each([
        ["D&D combat", "Combat"],
        ["d&d BOSS BATTLE", "Boss Battle"],
        ["D&D INTRO", "!!! Intro !!!"],
        ["Session D&D Forest/Day", "Forest / Day"],
        ["EMOTIONAL MUSIC", "Emotional Music"],
        ["Normal Explore", "Normal Explore"]
    ])("turns %s into %s", async (title, expectedName) => {
        const result = await dipsProcessor({
            id: "PL_fixture",
            snippet: {title}
        });

        expect(result).toEqual({
            name: expectedName,
            data: {
                id: "PL_fixture",
                link: "https://www.youtube.com/playlist?list=PL_fixture"
            }
        });
    });

    test.each(["D&D Timeline", "d&d timeline Chapter One", "Cooking", ""])(
        "excludes an unrelated or timeline title: %s",
        async (title) => {
            await expect(dipsProcessor({id: "PL_excluded", snippet: {title}}))
                .resolves.toBe(false);
        }
    );
});

describe("legacy playlist collection processing", () => {
    test("produces the expected playlist collection from a channel response", async () => {
        await expect(processPlaylists(channelResponse.items, dipsProcessor))
            .resolves.toEqual(expectedPlaylists);
    });

    test("returns an empty collection without calling the processor for an empty channel", async () => {
        const processor = jest.fn(async () => false as const);

        await expect(processPlaylists([], processor)).resolves.toEqual({});
        expect(processor).not.toHaveBeenCalled();
    });

    test("preserves the original channel response", async () => {
        const originalResponse = JSON.parse(JSON.stringify(channelResponse)) as typeof channelResponse;

        await processPlaylists(channelResponse.items, dipsProcessor);

        expect(channelResponse).toEqual(originalResponse);
    });

    test("currently keeps the last playlist when processed names collide", async () => {
        // Characterize the existing behavior; a future collision policy can change it deliberately.
        const playlists: playlistData[] = [
            {id: "PL_first", snippet: {title: "D&D Tavern"}},
            {id: "PL_last", snippet: {title: "d&d tavern"}}
        ];

        await expect(processPlaylists(playlists, dipsProcessor)).resolves.toEqual({
            Tavern: {
                id: "PL_last",
                link: "https://www.youtube.com/playlist?list=PL_last"
            }
        });
    });

    test("emits one canonical label per playlist ID before fetching counts", async () => {
        await expect(processPlaylists([
            {id: "PL_city", snippet: {title: "D&D City / Downtime"}},
            {id: "PL_city", snippet: {title: "D&D City"}},
            {id: "PL_other", snippet: {title: "D&D Other City"}}
        ], dipsProcessor)).resolves.toEqual({
            City: {id: "PL_city", link: "https://www.youtube.com/playlist?list=PL_city"},
            "Other City": {id: "PL_other", link: "https://www.youtube.com/playlist?list=PL_other"}
        });
    });

    test("propagates processing failures and stops before later playlists", async () => {
        const failure = new Error("Playlist processing failed");
        const playlists: playlistData[] = [
            {id: "PL_first", snippet: {title: "D&D Tavern"}},
            {id: "PL_failing", snippet: {title: "D&D Forest"}},
            {id: "PL_unvisited", snippet: {title: "D&D Boss"}}
        ];
        const processor = jest.fn(async (playlist: playlistData) => {
            if (playlist.id === "PL_failing") throw failure;
            return dipsProcessor(playlist);
        });

        await expect(processPlaylists(playlists, processor)).rejects.toBe(failure);
        expect(processor).toHaveBeenCalledTimes(2);
        expect(processor).toHaveBeenNthCalledWith(1, playlists[0]);
        expect(processor).toHaveBeenNthCalledWith(2, playlists[1]);
    });
});
