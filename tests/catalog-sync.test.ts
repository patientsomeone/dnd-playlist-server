import assert from "node:assert/strict";
import {CatalogSync, type CatalogPhase} from "../src/client/catalogSync";
import {parsePlaylistCatalog, parsePlaylistCacheState, type PlaylistCatalog} from "../src/shared/playlistCatalog";

const now = 1800000000000;
const snapshot = {lastUpdate: now, Travel: {id: "PL_travel", link: "travel", count: 4}};
const saved = parsePlaylistCatalog(snapshot, "UC_one");
assert(saved);

function deferred<T>() {
    return Promise.withResolvers<T>();
}

describe("catalog synchronization independent of playback", () => {
    let sync: CatalogSync;
    let storage: any;
    let request: jest.Mock;
    let catalogs: (PlaylistCatalog | undefined)[];
    let phases: CatalogPhase[];
    let state: any;

    beforeEach(() => {
        state = {channelId: "UC_one", lastUpdate: now, hasCache: true, locked: false, fresh: true, serverTime: now};
        storage = {load: jest.fn().mockResolvedValue(undefined), save: jest.fn(async (_scope, value) => value), close: jest.fn()};
        request = jest.fn(async (url: string) => ({ok: true, json: async () => url.startsWith("/cacheState") ? state : snapshot}));
        catalogs = [];
        phases = [];
        sync = new CatalogSync({
            storage, fetcher: request, onCatalog: (catalog) => catalogs.push(catalog), onPhase: (phase) => phases.push(phase)
        });
    });
    afterEach(() => { sync.dispose(); jest.useRealTimers(); });

    test("renders saved data before a delayed server check and skips downloading an unchanged catalog", async () => {
        storage.load.mockResolvedValue(saved);
        const pending = deferred<any>();
        request.mockImplementation(() => pending.promise);
        await sync.start();
        expect(catalogs).toEqual([saved]);
        expect(request).toHaveBeenCalledTimes(1);
        pending.resolve({ok: true, json: async () => state});
        await sync.check();
        expect(request.mock.calls.map(([url]) => url)).toEqual(["/cacheState"]);
        expect(sync.find("PL_travel")).toEqual({id: "PL_travel", name: "Travel", count: 4});
    });

    test("fetches and persists a newer server catalog, then coalesces simultaneous checks", async () => {
        storage.load.mockResolvedValue({...saved, lastUpdate: now - 1});
        await sync.start();
        await Promise.all([sync.check(), sync.check(), sync.check()]);
        expect(request.mock.calls.map(([url]) => url)).toEqual(["/cacheState", "/listCount?channelId=UC_one"]);
        expect(sync.catalog).toEqual(saved);
        expect(storage.save).toHaveBeenCalledWith("default", saved);
        expect(request.mock.calls[0][1]).toMatchObject({cache: "no-store", signal: expect.any(AbortSignal)});
    });

    test("a slow local read cannot gate server startup or overwrite its newer snapshot", async () => {
        jest.useFakeTimers();
        const disk = deferred<PlaylistCatalog | undefined>();
        storage.load.mockReturnValue(disk.promise);
        const starting = sync.start();
        await jest.advanceTimersByTimeAsync(99);
        expect(request.mock.calls.map(([url]) => url)).toEqual(["/cacheState"]);
        await jest.advanceTimersByTimeAsync(1);
        expect(sync.catalog).toEqual(saved);
        disk.resolve({...saved, lastUpdate: 1});
        await starting;
        expect(sync.catalog).toEqual(saved);
        expect(request.mock.calls.map(([url]) => url)).toEqual(["/cacheState", "/listCount?channelId=UC_one"]);
    });

    test("waits briefly for a healthy local read instead of downloading an unchanged payload", async () => {
        jest.useFakeTimers();
        const disk = deferred<PlaylistCatalog | undefined>();
        storage.load.mockReturnValue(disk.promise);
        const starting = sync.start();
        await jest.advanceTimersByTimeAsync(50);
        disk.resolve(saved);
        await starting;
        await sync.check();
        expect(sync.catalog).toEqual(saved);
        expect(request.mock.calls.map(([url]) => url)).toEqual(["/cacheState"]);
    });

    test("a late saved catalog restores offline browsing after the server check has already failed", async () => {
        const disk = deferred<PlaylistCatalog | undefined>();
        storage.load.mockReturnValue(disk.promise);
        request.mockRejectedValue(new Error("Offline"));
        const starting = sync.start();
        await sync.check();
        expect(phases.at(-1)).toBe("error");
        disk.resolve(saved);
        await starting;
        expect(sync.catalog).toEqual(saved);
        expect(phases.at(-1)).toBe("offline");
    });

    test("continues using the saved catalog when metadata requests fail", async () => {
        storage.load.mockResolvedValue(saved);
        request.mockRejectedValue(new Error("Offline"));
        await sync.start();
        await sync.beforeSelection();
        expect(sync.catalog).toEqual(saved);
        expect(phases).toContain("offline");
        expect(sync.find("PL_travel")).toMatchObject({count: 4});
    });

    test("uses memory when IndexedDB reads and writes are unavailable", async () => {
        storage.load.mockRejectedValue(new Error("Blocked"));
        storage.save.mockRejectedValue(new Error("Quota exceeded"));
        await sync.start();
        await sync.check();
        expect(sync.catalog).toEqual(saved);
        expect(phases.at(-1)).toBe("ready");
    });

    test("keeps stale data available while an expired server cache refresh runs in the background", async () => {
        storage.load.mockResolvedValue({...saved, lastUpdate: 1});
        state = {...state, lastUpdate: 1, fresh: false};
        const refresh = deferred<any>();
        request.mockImplementation(async (url: string) => url.startsWith("/refreshPlaylists")
            ? await refresh.promise : {ok: true, json: async () => state});
        await sync.start();
        await sync.beforeSelection();
        expect(sync.catalog?.lastUpdate).toBe(1);
        expect(phases).toContain("refreshing");
        refresh.resolve({ok: true, json: async () => snapshot});
        await new Promise((resolve) => setImmediate(resolve));
        expect(sync.catalog?.lastUpdate).toBe(now);
    });

    test("polls only cache metadata while another owner is refreshing", async () => {
        jest.useFakeTimers();
        storage.load.mockResolvedValue({...saved, lastUpdate: 1});
        state = {...state, lastUpdate: 1, fresh: false, locked: true};
        await sync.start();
        await sync.check();
        await jest.advanceTimersByTimeAsync(3000);
        expect(request.mock.calls.map(([url]) => url)).toEqual(["/cacheState", "/cacheState"]);
        state = {...state, lastUpdate: now, fresh: true, locked: false};
        await jest.advanceTimersByTimeAsync(3000);
        expect(sync.catalog).toEqual(saved);
        expect(request.mock.calls.some(([url]) => url.startsWith("/refreshPlaylists"))).toBe(false);
    });

    test("bounds selection waiting without cancelling a background update", async () => {
        jest.useFakeTimers();
        storage.load.mockResolvedValue(saved);
        const response = deferred<any>();
        request.mockReturnValue(response.promise);
        await sync.start();
        const selection = sync.beforeSelection();
        await jest.advanceTimersByTimeAsync(1500);
        await selection;
        expect(sync.find("PL_travel")).toBeDefined();
        response.resolve({ok: true, json: async () => state});
        await sync.check();
    });

    test("clears the old default channel before loading a newly configured channel", async () => {
        storage.load.mockResolvedValue(saved);
        state = {...state, channelId: "UC_two"};
        await sync.start();
        await sync.check();
        expect(catalogs[1]).toBeUndefined();
        expect(sync.catalog?.channelId).toBe("UC_two");
        expect(request.mock.calls.some(([url]) => url === "/listCount?channelId=UC_two")).toBe(true);
    });

    test("does not replace a newer saved snapshot with an older server seed", async () => {
        storage.load.mockResolvedValue({...saved, lastUpdate: now + 1});
        await sync.start();
        await sync.check();
        expect(sync.catalog?.lastUpdate).toBe(now + 1);
        expect(request).toHaveBeenCalledTimes(1);
    });

    test("reports an initial error and allows a manual retry", async () => {
        request.mockResolvedValueOnce({ok: false});
        await sync.start();
        await sync.check();
        expect(phases.at(-1)).toBe("error");
        await sync.retry();
        expect(sync.catalog).toEqual(saved);
    });

    test("bounds a stuck processing job and stops requests after disposal", async () => {
        jest.useFakeTimers();
        storage.load.mockResolvedValue(saved);
        state = {...state, locked: true, fresh: false};
        await sync.start();
        await sync.check();
        await jest.advanceTimersByTimeAsync(41 * 3000);
        expect(phases.at(-1)).toBe("offline");
        expect(request).toHaveBeenCalledTimes(41);
        sync.dispose();
        await jest.advanceTimersByTimeAsync(30000);
        expect(request).toHaveBeenCalledTimes(41);
        expect(storage.close).toHaveBeenCalled();
    });

    test("ignores a response arriving after disposal", async () => {
        const response = deferred<any>();
        request.mockReturnValue(response.promise);
        await sync.start();
        sync.dispose();
        response.resolve({ok: true, json: async () => state});
        await sync.check();
        await new Promise((resolve) => setImmediate(resolve));
        expect(catalogs).toEqual([]);
    });

    test("aborts a stalled request and retains the saved catalog", async () => {
        jest.useFakeTimers();
        storage.load.mockResolvedValue(saved);
        request.mockImplementation((_url, {signal}) => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("Aborted")));
        }));
        await sync.start();
        const checking = sync.check();
        await jest.advanceTimersByTimeAsync(5000);
        await checking;
        expect(sync.catalog).toEqual(saved);
        expect(request.mock.calls[0][1].signal.aborted).toBe(true);
        expect(phases.at(-1)).toBe("offline");
    });

    test("a failed background refresh applies a cooldown instead of restarting on every interaction", async () => {
        jest.useFakeTimers();
        storage.load.mockResolvedValue({...saved, lastUpdate: 1});
        state = {...state, lastUpdate: 1, fresh: false};
        request.mockImplementation(async (url: string) => ({
            ok: !url.startsWith("/refreshPlaylists"), json: async () => state
        }));
        await sync.start();
        await sync.check();
        await jest.advanceTimersByTimeAsync(3000);
        await sync.check();
        expect(request.mock.calls.filter(([url]) => url.startsWith("/refreshPlaylists"))).toHaveLength(1);
        expect(phases.at(-1)).toBe("offline");
        request.mockImplementation(async (url: string) => ({ok: true, json: async () => url.startsWith("/cacheState") ? state : snapshot}));
        await sync.retry();
        await jest.advanceTimersByTimeAsync(0);
        expect(sync.catalog?.lastUpdate).toBe(now);
    });

    test("a processing refresh response switches to metadata polling", async () => {
        jest.useFakeTimers();
        storage.load.mockResolvedValue({...saved, lastUpdate: 1});
        state = {...state, lastUpdate: 1, fresh: false};
        request.mockImplementation(async (url: string) => ({ok: true, json: async () => url.startsWith("/refreshPlaylists")
            ? {status: "processing"} : url.startsWith("/cacheState") ? state : snapshot}));
        await sync.start();
        await sync.check();
        await jest.advanceTimersByTimeAsync(0);
        state = {...state, lastUpdate: now, fresh: true};
        await jest.advanceTimersByTimeAsync(3000);
        expect(sync.catalog).toEqual(saved);
        expect(request.mock.calls.filter(([url]) => url.startsWith("/refreshPlaylists"))).toHaveLength(1);
    });

    test("a cold server cache is populated in the background without a premature full-cache read", async () => {
        state = {...state, hasCache: false, lastUpdate: null, fresh: false};
        await sync.start();
        await sync.check();
        await new Promise((resolve) => setImmediate(resolve));
        expect(sync.catalog).toEqual(saved);
        expect(request.mock.calls.some(([url]) => url.startsWith("/listCount"))).toBe(false);
    });

    test.each([{}, {...snapshot, lastUpdate: 2}])("rejects a missing or older catalog than metadata promised: %j", async (catalog) => {
        storage.load.mockResolvedValue({...saved, lastUpdate: 1});
        request.mockImplementation(async (url: string) => ({ok: true, json: async () => url.startsWith("/cacheState")
            ? state : catalog}));
        await sync.start();
        await sync.check();
        expect(sync.catalog?.lastUpdate).toBe(1);
        expect(phases.at(-1)).toBe("offline");
    });

    test("uses a newer catalog another tab persisted while its own response was in flight", async () => {
        const winner = {...saved, lastUpdate: now + 1};
        storage.save.mockResolvedValue(winner);
        await sync.start();
        await sync.check();
        expect(sync.catalog).toEqual(winner);
    });

    test("an explicit channel refuses a response belonging to another channel", async () => {
        sync.dispose();
        sync = new CatalogSync({storage, channelId: "UC_two", fetcher: request, onCatalog: jest.fn(), onPhase: (phase) => phases.push(phase)});
        expect(sync.scope).toBe("channel:UC_two");
        await sync.start();
        await sync.check();
        expect(sync.catalog).toBeUndefined();
        expect(phases.at(-1)).toBe("error");
    });

    test("a late refresh for a previous default channel cannot overwrite the new channel", async () => {
        storage.load.mockResolvedValue({...saved, lastUpdate: 1});
        state = {...state, lastUpdate: 1, fresh: false};
        const response = deferred<any>();
        request.mockImplementation(async (url: string) => url.startsWith("/refreshPlaylists") ? await response.promise
            : {ok: true, json: async () => url.startsWith("/cacheState") ? state : snapshot});
        await sync.start();
        await sync.check();
        state = {...state, channelId: "UC_two", lastUpdate: now, fresh: true};
        await sync.check();
        response.resolve({ok: true, json: async () => ({...snapshot, lastUpdate: now + 10})});
        await new Promise((resolve) => setImmediate(resolve));
        expect(sync.catalog?.channelId).toBe("UC_two");
        expect(sync.catalog?.lastUpdate).toBe(now);
    });

    test.each(["UC_one", "UC_two"])("a slow IndexedDB startup cannot replace an already updated %s catalog", async (channelId) => {
        const disk = deferred<PlaylistCatalog | undefined>();
        storage.load.mockReturnValue(disk.promise);
        state = {...state, channelId};
        const starting = sync.start();
        await sync.check(); // A focus/reconnect event checks the server before IndexedDB finishes.
        expect(sync.catalog?.channelId).toBe(channelId);
        disk.resolve({...saved, lastUpdate: 1});
        await starting;
        await sync.check();
        expect(sync.catalog?.channelId).toBe(channelId);
        expect(sync.catalog?.lastUpdate).toBe(now);
    });
});

describe("browser catalog contract validation", () => {
    test("separates metadata from arbitrary playlist labels", () => {
        const zither = {...snapshot.Travel, id: "PL_zither"};
        expect(parsePlaylistCatalog({...snapshot, zither}, "UC_one")?.playlists)
            .toEqual({Travel: snapshot.Travel, zither});
        expect(parsePlaylistCatalog({}, "UC_one")).toBeUndefined();
    });
    test("collapses duplicate IDs consistently regardless of alias order, retaining the chosen label's metadata", () => {
        const city = {id: "PL_city", link: "city", count: 35};
        const oldCity = {id: "PL_city", link: "old-city", count: 44};
        for (const entries of [[["City / Downtime", oldCity], ["City", city]], [["City", city], ["City / Downtime", oldCity]]] as const) {
            expect(parsePlaylistCatalog({...Object.fromEntries(entries), lastUpdate: now}, "UC_one")?.playlists).toEqual({City: city});
        }
    });
    test.each([null, [], {lastUpdate: "bad"}, {lastUpdate: 1, Invalid: {id: "", count: -1}}])(
        "rejects malformed catalog data: %j", (value) => expect(() => parsePlaylistCatalog(value, "UC_one")).toThrow()
    );
    test.each([null, {channelId: "../outside"}, {channelId: "UC_one", lastUpdate: 1, hasCache: false}])(
        "rejects malformed cache-state data: %j", (value) => expect(() => parsePlaylistCacheState(value)).toThrow()
    );
});
