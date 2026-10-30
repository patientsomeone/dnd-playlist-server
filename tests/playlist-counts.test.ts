import {getPlaylistCounts} from "../src/utilities/getPlaylistCounts";
import publishedItems from "./fixtures/playlist-items.json";

const mockListItems = jest.fn();
jest.mock("../src/utilities/fetchEnv", () => ({fetchEnv: jest.fn().mockResolvedValue("fixture-key")}));
jest.mock("@googleapis/youtube", () => ({
    youtube: jest.fn(() => ({playlistItems: {list: mockListItems}}))
}));

describe("YouTube playlist video counts", () => {
    const now = 1800000000000;
    beforeEach(() => {
        jest.spyOn(Date, "now").mockReturnValue(now);
        mockListItems.mockReset();
    });

    test("counts published videos across pages and does not mutate its input", async () => {
        mockListItems
            .mockResolvedValueOnce({data: {...publishedItems, nextPageToken: "page-2"}})
            .mockResolvedValueOnce({data: {items: [{contentDetails: {videoPublishedAt: "2024-01-02"}}]}});
        const playlist = {id: "PL_travel", link: "travel"};
        await expect(getPlaylistCounts({Travel: playlist})).resolves.toEqual({
            lastUpdate: now, Travel: {...playlist, count: 3}
        });
        expect(playlist).toEqual({id: "PL_travel", link: "travel"});
        expect(mockListItems.mock.calls.map(([query]) => query)).toEqual([
            {part: ["contentDetails"], playlistId: "PL_travel", maxResults: 50, pageToken: undefined},
            {part: ["contentDetails"], playlistId: "PL_travel", maxResults: 50, pageToken: "page-2"}
        ]);
    });

    test("omits playlists with no published videos and counts each list separately", async () => {
        mockListItems.mockImplementation(async ({playlistId}) => ({
            data: {items: playlistId === "PL_empty" ? [] : publishedItems.items}
        }));
        await expect(getPlaylistCounts({
            Empty: {id: "PL_empty", link: "empty"}, Tavern: {id: "PL_tavern", link: "tavern"}
        })).resolves.toEqual({lastUpdate: now, Tavern: {id: "PL_tavern", link: "tavern", count: 2}});
    });

    test("returns a complete empty-channel snapshot without making YouTube calls", async () => {
        await expect(getPlaylistCounts({})).resolves.toEqual({lastUpdate: now});
        expect(mockListItems).not.toHaveBeenCalled();
    });

    test("propagates quota failures without returning a partial snapshot", async () => {
        mockListItems.mockResolvedValueOnce({data: publishedItems}).mockRejectedValueOnce(new Error("Quota exceeded"));
        await expect(getPlaylistCounts({
            Travel: {id: "PL_travel", link: "travel"}, Boss: {id: "PL_boss", link: "boss"}
        })).rejects.toThrow("Quota exceeded");
    });

    test("handles absent item arrays and unpublished/missing contentDetails", async () => {
        mockListItems
            .mockResolvedValueOnce({data: {}})
            .mockResolvedValueOnce({data: {items: [{}, {contentDetails: {}}, ...publishedItems.items]}});
        await expect(getPlaylistCounts({
            Empty: {id: "PL_empty", link: "empty"}, Tavern: {id: "PL_tavern", link: "tavern"}
        })).resolves.toEqual({lastUpdate: now, Tavern: {id: "PL_tavern", link: "tavern", count: 2}});
    });

    test("rejects a repeated item page token instead of scanning forever", async () => {
        mockListItems.mockResolvedValue({data: {items: [], nextPageToken: "same-token"}});
        await expect(getPlaylistCounts({Travel: {id: "PL_travel", link: "travel"}})).rejects.toThrow("Repeated");
        expect(mockListItems).toHaveBeenCalledTimes(2);
    });
});
