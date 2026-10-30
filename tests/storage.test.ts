import {mkdtemp, mkdir, readFile, rm, writeFile} from "fs/promises";
import {tmpdir} from "os";
import {join, resolve, sep} from "path";
import {jsonUtils} from "../src/utilities/jsonUtils";
import {FsUtils} from "../src/utilities/fsUtils";
import {Config} from "../src/utilities/fetchConfig";
import type {WriteStream} from "node:fs";
import {once} from "node:events";

// Redirect the fixed Config path and jsonUtils paths into this suite's own directory.
// Real filesystem, JSON editor, and Config merge code remain in use.
let mockStorageRoot: string;
jest.mock("../src/utilities/srcPath", () => ({
    srcPath: (path: string) => {
        const paths = jest.requireActual<typeof import("path")>("path");
        return paths.isAbsolute(path) ? path : paths.join(mockStorageRoot, path);
    }
}));
jest.mock("../src/utilities/log", () => ({log: jest.fn(), err: jest.fn(), logLine: jest.fn()}));

describe("real temporary-file storage", () => {
    beforeEach(async () => {
        mockStorageRoot = await mkdtemp(join(tmpdir(), "dnd-storage-test-"));
        await mkdir(join(mockStorageRoot, "json"));
    });

    afterEach(async () => {
        // Only remove the exact directory created by this test, inside the OS temp root.
        const target = resolve(mockStorageRoot);
        if (!target.startsWith(resolve(tmpdir()) + sep) || !target.split(sep).pop()?.startsWith("dnd-storage-test-")) {
            throw new Error("Refusing to remove an unexpected storage test directory");
        }
        await rm(target, {recursive: true, force: true});
    });

    test("persists JSON values and arrays across independent instances", async () => {
        const cache = new jsonUtils("cache.json");
        cache.set("Travel", {id: "PL_travel", count: 3});
        cache.set("queue", ["first"]);
        cache.append("queue", "second");

        expect(new jsonUtils("cache.json").read()).toEqual({
            Travel: {id: "PL_travel", count: 3}, queue: ["first", "second"]
        });
        expect(JSON.parse(await readFile(join(mockStorageRoot, "cache.json"), "utf8")))
            .toEqual(cache.read());
    });

    test("reads nested values without changing sibling data", () => {
        const cache = new jsonUtils("nested.json");
        cache.set("metadata.channel", "UC_fixture");
        cache.set("metadata.lastUpdate", 123);
        expect(cache.get("metadata.channel")).toBe("UC_fixture");
        expect(cache.get("missing")).toBeUndefined();
        expect(cache.read()).toEqual({metadata: {channel: "UC_fixture", lastUpdate: 123}});
    });

    test("creates and resets a cache file using the real filesystem", async () => {
        const filePath = join(mockStorageRoot, "reset.json");
        const cache = new jsonUtils(filePath);
        await cache.checkPath();
        cache.set("Travel", {count: 3});
        await cache.checkPath();
        expect(new jsonUtils(filePath).read()).toEqual({Travel: {count: 3}});
        await cache.checkPath(true);
        expect(new jsonUtils(filePath).read()).toEqual({});
        expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({});
    });

    test("creates, reads, checks, and deletes an isolated lock file", async () => {
        const file = new FsUtils(join(mockStorageRoot, "channel.lock"));
        await expect(file.check()).rejects.toMatchObject({error: {code: "ENOENT"}});
        await file.create.raw("lock fixture");
        await expect(file.check()).resolves.toMatchObject({error: null});
        await expect(file.read.raw()).resolves.toMatchObject({data: "lock fixture"});
        await file.delete();
        await expect(file.check()).rejects.toMatchObject({error: {code: "ENOENT"}});
    });

    test("rejects a write to a missing parent directory", async () => {
        const file = new FsUtils(join(mockStorageRoot, "missing", "cache.json"));
        await expect(file.create.json({fixture: true})).rejects.toMatchObject({error: {code: "ENOENT"}});
    });

    test("initializes the lazy write stream before writing its first payload", async () => {
        const filePath = join(mockStorageRoot, "stream.txt");
        await writeFile(filePath, "initial:");
        const file = new FsUtils(filePath);
        // The legacy utility has no public close method; close this test's stream explicitly.
        const streams = file as unknown as {wStream?: WriteStream;};
        try {
            await file.writeStream.raw("first");
            await file.writeStream.raw("/second");
            expect(await readFile(filePath, "utf8")).toBe("initial:first/second");
        } finally {
            const stream = streams.wStream;
            if (stream) {
                const closed = once(stream, "close");
                stream.end();
                await closed;
            }
        }
    });

    test("rejects lazy stream initialization errors before trying to write", async () => {
        const file = new FsUtils(join(mockStorageRoot, "missing", "stream.txt"));
        await expect(file.writeStream.raw("fixture")).rejects.toMatchObject({error: {code: "ENOENT"}});
    });

    test("merges config defaults and existing overrides at the actual Config path", async () => {
        await writeFile(join(mockStorageRoot, "json", ".config.json"), JSON.stringify({
            label: "saved", playback: {shuffle: false}
        }));
        const config = new Config({label: "default", playback: {shuffle: true, loop: true}, added: "new"});

        await expect(config.fetch()).resolves.toEqual({
            label: "saved", playback: {shuffle: false, loop: true}, added: "new"
        });
        const persisted = JSON.parse(await readFile(join(mockStorageRoot, "json", ".config.json"), "utf8"));
        expect(persisted).toEqual({label: "saved", playback: {shuffle: false, loop: true}, added: "new"});
    });

    test("initializes missing configuration without touching the repository config", async () => {
        const defaults = {playlists: {channel: "UC_fixture"}, label: "fixture"};
        await expect(new Config(defaults).fetch()).resolves.toEqual(defaults);
        expect(JSON.parse(await readFile(join(mockStorageRoot, "json", ".config.json"), "utf8"))).toEqual(defaults);
    });

    test.todo("resets a jsonUtils file without stale in-memory editor data");
    test.todo("creates missing cache directories on a clean deployment");
    test.todo("handles corrupt cache JSON with an explicit recovery contract");
});
