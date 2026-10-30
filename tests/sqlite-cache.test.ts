import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, rm} from "fs/promises";
import {tmpdir} from "os";
import {join, resolve, sep} from "path";
import sqlite3 from "sqlite3";
import {spawn} from "child_process";
import {once} from "events";
import {ChannelPlaylistCache, SqlitePlaylistStore, REFRESH_LEASE_MS} from "../src/utilities/sqlitePlaylistCache";
import {getPlaylistCache, closePlaylistCache} from "../src/utilities/playlistCacher";

const oldSnapshot = {lastUpdate: 100, Travel: {id: "PL_old", link: "old", count: 2}};
const newSnapshot = {lastUpdate: 200, Boss: {id: "PL_new", link: "new", count: 5}};

describe("transactional SQLite playlist storage", () => {
    let directory: string;
    let databasePath: string;
    let stores: SqlitePlaylistStore[];

    const openStore = () => {
        const store = new SqlitePlaylistStore(databasePath);
        stores.push(store);
        return store;
    };
    const rawConnection = async () => {
        const db = await new Promise<sqlite3.Database>((resolve, reject) => {
            const connection = new sqlite3.Database(databasePath, (error) => error ? reject(error) : resolve(connection));
        });
        return {
            exec: (sql: string) => new Promise<void>((resolve, reject) => db.exec(sql, (error) => error ? reject(error) : resolve())),
            close: () => new Promise<void>((resolve, reject) => db.close((error) => error ? reject(error) : resolve()))
        };
    };

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "dnd-sqlite-test-"));
        databasePath = join(directory, "nested", "playlists.sqlite");
        stores = [];
    });
    afterEach(async () => {
        await closePlaylistCache();
        for (const store of stores) await store.close();
        const target = resolve(directory);
        if (!target.startsWith(resolve(tmpdir()) + sep) || !target.split(sep).pop()?.startsWith("dnd-sqlite-test-")) {
            throw new Error("Unexpected SQLite test cleanup path");
        }
        await rm(target, {recursive: true, force: true});
    });

    test("creates missing directories, preserves the legacy wire shape, and persists across reopening", async () => {
        const first = openStore();
        await expect(first.read("UC_one")).resolves.toEqual({});
        await first.replace("UC_one", oldSnapshot);
        await expect(openStore().read("UC_one")).resolves.toEqual(oldSnapshot);
    });

    test("replaces the entire channel and timestamp without changing another channel", async () => {
        const store = openStore();
        await store.replace("UC_one", oldSnapshot);
        await store.replace("UC_two", oldSnapshot);
        await store.replace("UC_one", newSnapshot);
        await expect(store.read("UC_one")).resolves.toEqual(newSnapshot);
        await expect(store.read("UC_two")).resolves.toEqual(oldSnapshot);
        await store.replace("UC_one", {lastUpdate: 300});
        await expect(store.read("UC_one")).resolves.toEqual({lastUpdate: 300});
    });

    test("rolls back both deletion and metadata if an actual SQL write fails", async () => {
        const store = openStore();
        await store.replace("UC_one", oldSnapshot);
        const raw = await rawConnection();
        try {
            await raw.exec(`CREATE TRIGGER reject_fixture BEFORE INSERT ON cached_playlists
                WHEN NEW.name = 'Boss' BEGIN SELECT RAISE(ABORT, 'Fixture disk failure'); END;`);
            await expect(store.replace("UC_one", newSnapshot)).rejects.toThrow("Fixture disk failure");
            await expect(store.read("UC_one")).resolves.toEqual(oldSnapshot);
            await raw.exec("DROP TRIGGER reject_fixture");
            await store.replace("UC_one", newSnapshot);
            await expect(store.read("UC_one")).resolves.toEqual(newSnapshot);
        } finally {
            await raw.close();
        }
    });

    test("readers on another connection see the previous committed catalog during an incomplete write", async () => {
        const store = openStore();
        await store.replace("UC_one", oldSnapshot);
        const reader = openStore();
        await reader.read("UC_one");
        const writer = await rawConnection();
        try {
            await writer.exec(`BEGIN IMMEDIATE;
                UPDATE cache_channels SET last_update = 999 WHERE channel_id = 'UC_one';
                DELETE FROM cached_playlists WHERE channel_id = 'UC_one';`);
            await expect(reader.read("UC_one")).resolves.toEqual(oldSnapshot);
            await writer.exec("ROLLBACK");
            await expect(reader.read("UC_one")).resolves.toEqual(oldSnapshot);
        } finally {
            await writer.close();
        }
    });

    test("metadata reads see committed timestamps even while the store's writer has an incomplete transaction", async () => {
        const store = openStore();
        await store.replace("UC_one", oldSnapshot);
        // Inject an unfinished transaction on the actual writer connection.
        const writer: sqlite3.Database = await (store as any).database;
        const exec = (sql: string) => new Promise<void>((resolve, reject) => writer.exec(sql, (error) => error ? reject(error) : resolve()));
        try {
            await exec("BEGIN IMMEDIATE; UPDATE cache_channels SET last_update = 999 WHERE channel_id = 'UC_one';");
            await expect(store.state("UC_one")).resolves.toMatchObject({lastUpdate: 100, locked: false});
        } finally {
            await exec("ROLLBACK");
        }
        await expect(store.state("UC_one")).resolves.toMatchObject({lastUpdate: 100});
    });

    test("only one competing connection can acquire a channel lease", async () => {
        const first = openStore();
        const second = openStore();
        await first.read("UC_one");
        await second.read("UC_one");
        const tokens = await Promise.all([first.acquire("UC_one"), second.acquire("UC_one")]);
        expect(tokens.filter(Boolean)).toHaveLength(1);
        expect(await first.isRefreshing("UC_one")).toBe(true);
        expect(await second.acquire("UC_two")).toEqual(expect.any(String));
    });

    test("an abandoned lease expires after restart and the old owner cannot overwrite or release its successor", async () => {
        const clock = jest.spyOn(Date, "now").mockReturnValue(100000);
        const first = openStore();
        const oldToken = await first.acquire("UC_one");
        assert(oldToken);
        const second = openStore();
        expect(await second.acquire("UC_one")).toBeNull();
        clock.mockReturnValue(100000 + REFRESH_LEASE_MS);
        const newToken = await second.acquire("UC_one");
        assert(newToken);
        expect(newToken).toEqual(expect.any(String));
        await expect(first.replace("UC_one", oldSnapshot, oldToken)).rejects.toThrow("lease was lost");
        await first.release("UC_one", oldToken);
        expect(await second.isRefreshing("UC_one")).toBe(true);
        await second.replace("UC_one", newSnapshot, newToken);
        await second.release("UC_one", newToken);
        expect(await second.isRefreshing("UC_one")).toBe(false);
    });

    test("renewal extends a lease, but cannot revive an expired one", async () => {
        const clock = jest.spyOn(Date, "now").mockReturnValue(100000);
        const store = openStore();
        const token = await store.acquire("UC_one");
        assert(token);
        clock.mockReturnValue(100000 + REFRESH_LEASE_MS / 2);
        expect(await store.renew("UC_one", token)).toBe(true);
        clock.mockReturnValue(100000 + REFRESH_LEASE_MS);
        expect(await store.acquire("UC_one")).toBeNull();
        clock.mockReturnValue(100000 + REFRESH_LEASE_MS * 2);
        expect(await store.renew("UC_one", token)).toBe(false);
        expect(await store.isRefreshing("UC_one")).toBe(false);
    });

    test("imports a valid per-channel legacy JSON once without altering it or overwriting newer SQL data", async () => {
        const store = openStore();
        const legacyDirectory = join(directory, "legacy");
        await mkdir(legacyDirectory);
        const legacyFile = join(legacyDirectory, "UC_one.json");
        const original = JSON.stringify(oldSnapshot);
        await writeFile(legacyFile, original);
        const cache = new ChannelPlaylistCache(store, "UC_one", legacyDirectory);
        await expect(cache.read()).resolves.toEqual(oldSnapshot);
        await store.replace("UC_one", newSnapshot);
        await expect(cache.read()).resolves.toEqual(newSnapshot);
        expect(await readFile(legacyFile, "utf8")).toBe(original);
        await expect(new ChannelPlaylistCache(store, "UC_two", legacyDirectory).read()).resolves.toEqual({});
    });

    test("ignores malformed legacy JSON and never assigns the unattributed listCount seed to a channel", async () => {
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        const legacyDirectory = join(directory, "legacy");
        await mkdir(legacyDirectory);
        await writeFile(join(legacyDirectory, "UC_one.json"), "broken JSON");
        await writeFile(join(legacyDirectory, "listCount.json"), JSON.stringify(oldSnapshot));
        const store = openStore();
        await expect(new ChannelPlaylistCache(store, "UC_one", legacyDirectory).read()).resolves.toEqual({});
        await expect(new ChannelPlaylistCache(store, "UC_two", legacyDirectory).read()).resolves.toEqual({});
    });

    test("does not overwrite an existing channel during racing legacy imports", async () => {
        const first = openStore();
        await first.replace("UC_one", newSnapshot);
        await first.replace("UC_one", oldSnapshot, undefined, true);
        await expect(first.read("UC_one")).resolves.toEqual(newSnapshot);
    });

    test("normalizes duplicate IDs on replacement and when reading older databases without changing freshness", async () => {
        const store = openStore();
        const city = {id: "PL_city", link: "city", count: 35};
        await store.replace("UC_one", {lastUpdate: 123, "City / Downtime": {...city, count: 44}, City: city});
        await expect(store.read("UC_one")).resolves.toEqual({lastUpdate: 123, City: city});
        const raw = await rawConnection();
        try {
            await raw.exec("INSERT INTO cached_playlists(channel_id, name, id, link, video_count) VALUES ('UC_one', 'City / Downtime', 'PL_city', 'old-city', 44)");
            await expect(store.read("UC_one")).resolves.toEqual({lastUpdate: 123, City: city});
        } finally { await raw.close(); }
    });

    test("stores unusual labels and SQL-looking strings as data", async () => {
        const store = openStore();
        const label = "Travel. Campfire '); DROP TABLE cache_channels; --";
        const snapshot = {lastUpdate: 123, [label]: {id: "PL_one", link: "fixture", count: 1}};
        await store.replace("UC_one", snapshot);
        await expect(store.read("UC_one")).resolves.toEqual(snapshot);
    });

    test("rejects invalid snapshots before touching the old data", async () => {
        const store = openStore();
        await store.replace("UC_one", oldSnapshot);
        expect(() => store.replace("UC_one", {lastUpdate: NaN})).toThrow("timestamp");
        expect(() => store.replace("UC_one", {lastUpdate: 123, Travel: {id: "PL_bad", link: "bad", count: -1}})).toThrow("playlist");
        await expect(store.read("UC_one")).resolves.toEqual(oldSnapshot);
    });

    test("the application factory uses the configured private database path", async () => {
        const previous = process.env.PLAYLIST_CACHE_DB_PATH;
        process.env.PLAYLIST_CACHE_DB_PATH = databasePath;
        try {
            const cache = getPlaylistCache("UC_factory_fixture");
            const token = await cache.acquire();
        assert(token);
            expect(await cache.renew(token)).toBe(true);
            await cache.replace(oldSnapshot, token);
            await cache.release(token);
            await expect(cache.read()).resolves.toEqual(oldSnapshot);
            await expect(openStore().read("UC_factory_fixture")).resolves.toEqual(oldSnapshot);
        } finally {
            if (previous === undefined) delete process.env.PLAYLIST_CACHE_DB_PATH;
            else process.env.PLAYLIST_CACHE_DB_PATH = previous;
        }
    });

    test("closing drains queued work and prevents further operations", async () => {
        const store = openStore();
        const pending = store.replace("UC_one", oldSnapshot);
        await store.close();
        await pending;
        await expect(store.read("UC_one")).rejects.toThrow("closed");
        await expect(openStore().read("UC_one")).resolves.toEqual(oldSnapshot);
    });

    test("a killed writer rolls back partial data and its abandoned lease can be recovered", async () => {
        const store = openStore();
        await store.replace("UC_one", oldSnapshot);
        const child = spawn(process.execPath, [join(__dirname, "fixtures", "sqlite-crash-writer.cjs"), databasePath, String(REFRESH_LEASE_MS)], {
            windowsHide: true,
            stdio: ["ignore", "ignore", "pipe", "ipc"]
        });
        const exited = once(child, "exit");
        let errors = "";
        assert(child.stderr);
        child.stderr.on("data", (chunk) => { errors += String(chunk); });
        try {
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("Crash fixture did not initialize: " + errors)), 5000);
                child.once("message", () => { clearTimeout(timer); resolve(); });
                child.once("exit", () => { clearTimeout(timer); reject(new Error("Crash fixture exited early: " + errors)); });
                child.once("error", (error) => { clearTimeout(timer); reject(error); });
            });
            await expect(store.read("UC_one")).resolves.toEqual(oldSnapshot);
            expect(await store.isRefreshing("UC_one")).toBe(true);
            child.kill();
            await exited;
            await expect(openStore().read("UC_one")).resolves.toEqual(oldSnapshot);
            expect(await store.acquire("UC_one")).toBeNull();
            jest.spyOn(Date, "now").mockReturnValue(Date.now() + REFRESH_LEASE_MS + 1);
            const token = await store.acquire("UC_one");
        assert(token);
            expect(token).toEqual(expect.any(String));
            await store.replace("UC_one", newSnapshot, token);
            await store.release("UC_one", token);
            await expect(store.read("UC_one")).resolves.toEqual(newSnapshot);
        } finally {
            if (child.exitCode === null) child.kill();
            await exited;
        }
    }, 15000);
});
