import {createServer, type Server} from "http";
import type {AddressInfo} from "net";
import {mkdtemp, rm} from "fs/promises";
import {tmpdir} from "os";
import {join, resolve, sep} from "path";
import sqlite3 from "sqlite3";
import {app} from "../src/routes/app";
import {getPlaylistCounts} from "../src/utilities/getPlaylistCounts";
import {getPlaylistCache} from "../src/utilities/playlistCacher";
import {ChannelPlaylistCache, SqlitePlaylistStore, REFRESH_LEASE_MS} from "../src/utilities/sqlitePlaylistCache";

let mockStore: SqlitePlaylistStore;
const mockListPlaylists = jest.fn();
const defaultChannel = "UC_fixture_default";
const otherChannel = "UC_fixture_other";

jest.mock("../src/utilities/log", () => ({log: jest.fn(), err: jest.fn()}));
jest.mock("dotenv", () => ({config: jest.fn()}));
jest.mock("../src/index", () => ({reactResponse: jest.fn()}));
jest.mock("../src/routes/reactRoutes", () => ({reactRoutes: {}}));
jest.mock("../src/utilities/fetchEnv", () => ({
    fetchEnv: jest.fn(async (key: string) => {
        if (key === "YT_LIST_OWNER") return "UC_fixture_default";
        if (key === "YT_API_KEY") return "fixture-api-key";
        throw new Error("Unexpected environment lookup: " + key);
    })
}));
jest.mock("../src/utilities/playlistCacher", () => ({
    getPlaylistCache: jest.fn((channelId: string) => new ChannelPlaylistCache(mockStore, channelId))
}));
jest.mock("@googleapis/youtube", () => ({
    youtube: jest.fn(() => ({playlists: {list: mockListPlaylists}}))
}));
jest.mock("../src/utilities/getPlaylistCounts", () => ({getPlaylistCounts: jest.fn()}));

describe("SQLite-backed playlist API", () => {
    let server: Server;
    let baseUrl: string;
    let directory: string;
    let refreshedData: any;

    beforeAll(async () => {
        server = createServer(app);
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    });
    beforeEach(async () => {
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        directory = await mkdtemp(join(tmpdir(), "dnd-api-sqlite-"));
        mockStore = new SqlitePlaylistStore(join(directory, "cache.sqlite"));
        mockListPlaylists.mockReset().mockResolvedValue({
            data: {items: [{id: "PL_refreshed", snippet: {title: "D&D Tavern"}}]}
        });
        refreshedData = {
            lastUpdate: Date.now(),
            Tavern: {id: "PL_refreshed", link: "https://www.youtube.com/playlist?list=PL_refreshed", count: 3}
        };
        jest.mocked(getPlaylistCounts).mockReset().mockResolvedValue(refreshedData);
    });
    afterEach(async () => {
        await mockStore.close();
        const target = resolve(directory);
        if (!target.startsWith(resolve(tmpdir()) + sep) || !target.split(sep).pop()?.startsWith("dnd-api-sqlite-")) {
            throw new Error("Unexpected API test cleanup path");
        }
        await rm(target, {recursive: true, force: true});
    });

    const getJson = async (path: string) => {
        const response = await fetch(baseUrl + path);
        expect(response.status).toBe(200);
        return response.json();
    };

    test("reads the configured SQLite channel and reuses fresh data without YouTube", async () => {
        await mockStore.replace(defaultChannel, refreshedData);
        await expect(getJson("/listCount")).resolves.toEqual(refreshedData);
        await expect(getJson("/refreshPlaylists")).resolves.toEqual(refreshedData);
        expect(mockListPlaylists).not.toHaveBeenCalled();
        expect(getPlaylistCounts).not.toHaveBeenCalled();
    });

    test("cacheState returns timestamp/lease metadata without reading the catalog or calling YouTube", async () => {
        await mockStore.replace(defaultChannel, refreshedData);
        const catalogRead = jest.spyOn(mockStore, "read");
        const response = await fetch(baseUrl + "/cacheState");
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({
            channelId: defaultChannel, lastUpdate: refreshedData.lastUpdate, hasCache: true, locked: false, fresh: true
        });
        expect(catalogRead).not.toHaveBeenCalled();
        expect(mockListPlaylists).not.toHaveBeenCalled();
        expect(getPlaylistCounts).not.toHaveBeenCalled();
    });

    test("cacheState reports cold channels and active/expired leases independently", async () => {
        await expect(getJson("/cacheState?channelId=" + otherChannel)).resolves.toMatchObject({
            channelId: otherChannel, lastUpdate: null, hasCache: false, locked: false, fresh: false
        });
        await mockStore.replace(defaultChannel, {...refreshedData, lastUpdate: 1});
        await mockStore.acquire(defaultChannel);
        await expect(getJson("/cacheState")).resolves.toMatchObject({lastUpdate: 1, fresh: false, locked: true});
        jest.spyOn(Date, "now").mockReturnValue(Date.now() + REFRESH_LEASE_MS + 1);
        await expect(getJson("/cacheState")).resolves.toMatchObject({lastUpdate: 1, fresh: false, locked: false});
    });

    test("cacheState validates channel queries and returns JSON errors", async () => {
        const response = await fetch(baseUrl + "/cacheState?channelId[]=one&channelId[]=two");
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({error: "Invalid YouTube channel ID"});
        jest.spyOn(mockStore, "state").mockRejectedValueOnce(new Error("Fixture metadata error"));
        expect((await fetch(baseUrl + "/cacheState")).status).toBe(500);
    });

    test("makes a complete refresh visible to the next default-channel read", async () => {
        await expect(getJson("/refreshPlaylists")).resolves.toEqual(refreshedData);
        await expect(getJson("/listCount")).resolves.toEqual(refreshedData);
        expect(getPlaylistCounts).toHaveBeenCalledWith({
            Tavern: {id: "PL_refreshed", link: "https://www.youtube.com/playlist?list=PL_refreshed"}
        });
        expect(await mockStore.isRefreshing(defaultChannel)).toBe(false);
    });

    test("refreshes another channel without changing the default channel", async () => {
        await mockStore.replace(defaultChannel, {lastUpdate: 1});
        await expect(getJson("/refreshPlaylists?channelId=" + otherChannel)).resolves.toEqual(refreshedData);
        await expect(getJson("/listCount?channelId=" + otherChannel)).resolves.toEqual(refreshedData);
        await expect(getJson("/listCount")).resolves.toEqual({lastUpdate: 1});
    });

    test("returns processing for an existing lease without making YouTube calls", async () => {
        await mockStore.acquire(defaultChannel);
        await expect(getJson("/refreshPlaylists")).resolves.toEqual({status: "processing"});
        expect(mockListPlaylists).not.toHaveBeenCalled();
        expect(getPlaylistCounts).not.toHaveBeenCalled();
    });

    test("deduplicates in-flight refreshes while readers retain the previous complete snapshot", async () => {
        const old = {...refreshedData, lastUpdate: 1};
        await mockStore.replace(defaultChannel, old);
        let signalStarted: () => void;
        const started = new Promise<void>((resolve) => { signalStarted = resolve; });
        const {promise: upstream, resolve: unblock} = Promise.withResolvers<any>();
        mockListPlaylists.mockImplementationOnce(() => { signalStarted(); return upstream; });
        const first = fetch(baseUrl + "/refreshPlaylists");
        const response = {data: {items: [{id: "PL_refreshed", snippet: {title: "D&D Tavern"}}]}};
        try {
            await started;
            await expect(getJson("/refreshPlaylists")).resolves.toEqual({status: "processing"});
            await expect(getJson("/listCount")).resolves.toEqual(old);
            expect(mockListPlaylists).toHaveBeenCalledTimes(1);
            unblock(response);
            expect(await (await first).json()).toEqual(refreshedData);
            await expect(getJson("/listCount")).resolves.toEqual(refreshedData);
        } finally {
            unblock(response);
            await first;
        }
    });

    test("fetches all playlist pages before counting", async () => {
        mockListPlaylists
            .mockResolvedValueOnce({data: {items: [{id: "PL_travel", snippet: {title: "D&D Travel"}}], nextPageToken: "page-2"}})
            .mockResolvedValueOnce({data: {items: [{id: "PL_boss", snippet: {title: "D&D Boss"}}]}});
        await getJson("/refreshPlaylists");
        expect(mockListPlaylists.mock.calls.map(([query]) => query)).toEqual([
            {part: ["id", "snippet", "status"], maxResults: 50, channelId: defaultChannel},
            {part: ["id", "snippet", "status"], maxResults: 50, channelId: defaultChannel, pageToken: "page-2"}
        ]);
        expect(getPlaylistCounts).toHaveBeenCalledWith({
            Travel: {id: "PL_travel", link: "https://www.youtube.com/playlist?list=PL_travel"},
            Boss: {id: "PL_boss", link: "https://www.youtube.com/playlist?list=PL_boss"}
        });
    });

    test.each(["renewed", "lost", "renewal error"])("handles a long refresh whose lease is %s", async (state) => {
        jest.useFakeTimers({doNotFake: ["nextTick", "setImmediate", "setTimeout", "clearTimeout"]});
        const startedAt = Date.now();
        let signalStarted: () => void;
        const started = new Promise<void>((resolve) => { signalStarted = resolve; });
        const {promise: upstream, resolve: unblock} = Promise.withResolvers<any>();
        if (state === "lost") jest.spyOn(mockStore, "renew").mockResolvedValue(false);
        if (state === "renewal error") jest.spyOn(mockStore, "renew").mockRejectedValue(new Error("Fixture renewal failure"));
        mockListPlaylists.mockImplementationOnce(() => { signalStarted(); return upstream; });
        const request = fetch(baseUrl + "/refreshPlaylists");
        const response = {data: {items: [{id: "PL_refreshed", snippet: {title: "D&D Tavern"}}]}};
        try {
            await started;
            await jest.advanceTimersByTimeAsync(REFRESH_LEASE_MS / 3);
            await mockStore.read(defaultChannel); // Drain the queued renewal.
            if (state === "renewed") {
                jest.setSystemTime(startedAt + REFRESH_LEASE_MS + 1);
                expect(await mockStore.isRefreshing(defaultChannel)).toBe(true);
            }
            unblock(response);
            const result = await request;
            expect(result.status).toBe(state === "renewed" ? 200 : 502);
            expect(await mockStore.isRefreshing(defaultChannel)).toBe(false);
            await expect(mockStore.read(defaultChannel)).resolves.toEqual(state === "renewed" ? refreshedData : {});
        } finally {
            unblock(response);
            await request;
            jest.useRealTimers();
        }
    });

    test.each(["upstream", "counting"])("preserves old data and releases the lease after a %s failure", async (stage) => {
        const old = {...refreshedData, lastUpdate: 1};
        await mockStore.replace(defaultChannel, old);
        const error = new Error("Fixture failure containing fixture-secret");
        if (stage === "upstream") mockListPlaylists.mockRejectedValueOnce(error);
        else jest.mocked(getPlaylistCounts).mockRejectedValueOnce(error);
        const response = await fetch(baseUrl + "/refreshPlaylists");
        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({error: "Unable to refresh playlists"});
        await expect(getJson("/listCount")).resolves.toEqual(old);
        expect(await mockStore.isRefreshing(defaultChannel)).toBe(false);
        await expect(getJson("/refreshPlaylists")).resolves.toEqual(refreshedData);
    });

    test("rolls back an actual SQL write failure and releases the refresh lease", async () => {
        const old = {...refreshedData, lastUpdate: 1};
        await mockStore.replace(defaultChannel, old);
        const db = new sqlite3.Database(mockStore.filePath);
        const exec = (sql: string) => new Promise<void>((resolve, reject) => db.exec(sql, (error) => error ? reject(error) : resolve()));
        try {
            await exec("CREATE TRIGGER reject_refresh BEFORE INSERT ON cached_playlists BEGIN SELECT RAISE(ABORT, 'Fixture disk failure'); END;");
            const response = await fetch(baseUrl + "/refreshPlaylists");
            expect(response.status).toBe(502);
            await expect(getJson("/listCount")).resolves.toEqual(old);
            expect(await mockStore.isRefreshing(defaultChannel)).toBe(false);
            await exec("DROP TRIGGER reject_refresh");
            await expect(getJson("/refreshPlaylists")).resolves.toEqual(refreshedData);
        } finally {
            await new Promise<void>((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
        }
    });

    test("handles a cold start and an empty channel", async () => {
        await expect(getJson("/listCount")).resolves.toEqual({});
        mockListPlaylists.mockResolvedValue({data: {}});
        jest.mocked(getPlaylistCounts).mockResolvedValueOnce({lastUpdate: 123});
        await expect(getJson("/refreshPlaylists")).resolves.toEqual({lastUpdate: 123});
        expect(getPlaylistCounts).toHaveBeenCalledWith({});
    });

    test.each(["../outside", "", "one&channelId=two", "one&channelId[nested]=two"])(
        "returns a controlled 400 for an invalid channel query: %s", async (query) => {
            const response = await fetch(baseUrl + "/refreshPlaylists?channelId=" + query);
            expect(response.status).toBe(400);
            expect(mockListPlaylists).not.toHaveBeenCalled();
        }
    );

    test("returns JSON read errors rather than an unrelated 404", async () => {
        jest.spyOn(mockStore, "read").mockRejectedValueOnce(new Error("Fixture SQLite failure"));
        const response = await fetch(baseUrl + "/listCount");
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({error: "Unable to read playlist cache"});
    });

    test("rejects repeated pagination tokens and incomplete API data without replacing good data", async () => {
        await mockStore.replace(defaultChannel, {lastUpdate: 1});
        mockListPlaylists.mockResolvedValue({data: {items: [], nextPageToken: "same-token"}});
        expect((await fetch(baseUrl + "/refreshPlaylists")).status).toBe(502);
        expect(mockListPlaylists).toHaveBeenCalledTimes(2);
        mockListPlaylists.mockResolvedValue({data: {items: [{id: "PL_missing_title"}]}});
        expect((await fetch(baseUrl + "/refreshPlaylists")).status).toBe(502);
        await expect(getJson("/listCount")).resolves.toEqual({lastUpdate: 1});
        expect(await mockStore.isRefreshing(defaultChannel)).toBe(false);
    });

    test.each([
        [6 * 60 * 60 * 1000, false],
        [12 * 60 * 60 * 1000, true],
        [12 * 60 * 60 * 1000 + 1, true]
    ])("preserves the original freshness check at age %i ms", async (age, shouldRefresh) => {
        const now = Date.now();
        jest.spyOn(Date, "now").mockReturnValue(now);
        const old = {...refreshedData, lastUpdate: now - Number(age)};
        await mockStore.replace(defaultChannel, old);
        await expect(getJson("/refreshPlaylists")).resolves.toEqual(shouldRefresh ? refreshedData : old);
        expect(mockListPlaylists).toHaveBeenCalledTimes(shouldRefresh ? 1 : 0);
    });

    test("serves legacy assets, 404s, and CORS without refreshing", async () => {
        const page = await fetch(baseUrl);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("/createList.js");
        expect((await fetch(baseUrl + "/createList.js")).status).toBe(200);
        const missing = await fetch(baseUrl + "/fixture-missing-route");
        expect(missing.status).toBe(404);
        expect(await missing.text()).toContain("This is not the page you are looking for");
        const preflight = await fetch(baseUrl + "/listCount", {
            method: "OPTIONS", headers: {Origin: "https://fixture.invalid", "Access-Control-Request-Method": "GET"}
        });
        expect(preflight.status).toBe(204);
        expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
        expect(mockListPlaylists).not.toHaveBeenCalled();
    });
});

describe("cache channel boundaries", () => {
    test.each(["../outside", "..\\outside", "", "channel/other"])("rejects unsafe channel IDs: %s", (channelId) => {
        expect(() => getPlaylistCache(channelId)).toThrow("Invalid YouTube channel ID");
    });
});
