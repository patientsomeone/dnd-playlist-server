// Exercise the compiled application store, rather than the earlier SQL prototype.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {performance} = require("node:perf_hooks");
const {SqlitePlaylistStore} = require("../dist/server/utilities/sqlitePlaylistCache");

function option(name, fallback) {
    return process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}
const sizes = option("sizes", "1000,10000,100000").split(",").map(Number);
const samples = Number(option("samples", "5"));
if (sizes.some((size) => !Number.isSafeInteger(size) || size < 1 || size > 1000000) ||
    !Number.isSafeInteger(samples) || samples < 1 || samples > 100) throw new Error("Invalid benchmark sizes/samples");

const round = (value) => Math.round(value * 1000) / 1000;
const mib = (bytes) => round(bytes / 1024 / 1024);

async function main() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dnd-sqlite-store-bench-"));
    const store = new SqlitePlaylistStore(path.join(directory, "cache.sqlite"));
    const results = [];
    try {
        const control = {lastUpdate: 1700000000000, Control: {id: "PL_control", link: "fixture", count: 1}};
        await store.replace("UC_control", control);
        for (const size of sizes) {
            if (global.gc) global.gc();
            const rssBeforeMiB = mib(process.memoryUsage().rss);
            const snapshot = Object.fromEntries(Array.from({length: size}, (_, index) => [
                `Playlist ${String(index).padStart(7, "0")}`,
                {id: `PL_${index}`, link: `https://www.youtube.com/playlist?list=PL_${index}`, count: index % 100 + 1}
            ]));
            snapshot.lastUpdate = 1700000000000;
            const token = await store.acquire("UC_benchmark");
            assert.ok(token);
            const replaceStart = performance.now();
            const replacement = store.replace("UC_benchmark", snapshot, token).then(() => round(performance.now() - replaceStart));
            const stateStart = performance.now();
            const stateProbe = store.state("UC_benchmark").then((state) => {
                assert.equal(state.locked, true);
                return round(performance.now() - stateStart);
            });
            const [replaceMs, stateDuringWriteMs] = await Promise.all([replacement, stateProbe]);
            await store.release("UC_benchmark", token);
            assert.deepEqual(await store.read("UC_control"), control);
            assert.deepEqual(await store.read("UC_benchmark"), snapshot);
            const stateTimes = [];
            let stateBytes;
            for (let sample = 0; sample < samples + 2; sample += 1) {
                const start = performance.now();
                const state = await store.state("UC_benchmark");
                const payload = JSON.stringify(state);
                if (sample >= 2) stateTimes.push(performance.now() - start);
                assert.equal(state.lastUpdate, snapshot.lastUpdate);
                assert.equal(state.locked, false);
                stateBytes = Buffer.byteLength(payload);
            }
            stateTimes.sort((a, b) => a - b);
            const durations = [];
            let responseBytes;
            for (let sample = 0; sample < samples + 2; sample += 1) {
                if (global.gc) global.gc();
                const start = performance.now();
                const payload = JSON.stringify(await store.read("UC_benchmark"));
                if (sample >= 2) durations.push(performance.now() - start);
                responseBytes = Buffer.byteLength(payload);
            }
            durations.sort((a, b) => a - b);
            if (global.gc) global.gc();
            const concurrentStart = performance.now();
            const counts = await Promise.all(Array.from({length: 4}, async () => {
                const data = await store.read("UC_benchmark");
                const serialized = JSON.stringify(data);
                assert.equal(Buffer.byteLength(serialized), responseBytes);
                return Object.keys(data).length - 1;
            }));
            assert.deepEqual(counts, [size, size, size, size]);
            const result = {
                playlists: size, samples, replaceMs,
                stateReadP50Ms: round(stateTimes[Math.floor(stateTimes.length / 2)]), stateDuringWriteMs, stateResponseBytes: stateBytes,
                fullReadSerializeP50Ms: round(durations[Math.floor(durations.length / 2)]),
                fullReadSerializeP95Ms: round(durations[Math.ceil(durations.length * 0.95) - 1]),
                fourQueuedReadsMs: round(performance.now() - concurrentStart),
                responseBytes, rssBeforeMiB, rssAfterMiB: mib(process.memoryUsage().rss),
                processMaxRssMiB: round(process.resourceUsage().maxRSS / 1024)
            };
            results.push(result);
            console.table([result]);
        }
        const output = option("output", "");
        if (output) {
            await fs.mkdir(path.dirname(path.resolve(output)), {recursive: true});
            await fs.writeFile(output, JSON.stringify({
                recordedAt: new Date().toISOString(), node: process.version,
                platform: process.platform, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length,
                note: "Warm full-channel storage reads/serialization; queued calls on one connection, not HTTP capacity. Max RSS is the process lifetime high-water mark.",
                results
            }, null, 2) + "\n");
        }
    } finally {
        await store.close();
        const target = path.resolve(directory);
        if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith("dnd-sqlite-store-bench-")) {
            throw new Error("Unexpected benchmark cleanup path");
        }
        await fs.rm(target, {recursive: true, force: true});
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
