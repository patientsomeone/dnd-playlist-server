const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {performance} = require("node:perf_hooks");
const sqlite3 = require("sqlite3");

const updatedAt = 1700000000000;
const pageSize = 100;

function option(name, fallback) {
    const argument = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
    return argument ? argument.slice(name.length + 3) : fallback;
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (error) => error ? reject(error) : resolve());
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

function close(db) {
    return new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
}

function payload(rows) {
    return Object.fromEntries([
        ["lastUpdate", updatedAt],
        ...rows.map((row) => [row.name, {id: row.id, link: row.link, count: row.count}])
    ]);
}

function rounded(value) {
    return Number(value.toFixed(3));
}

async function measure(operation, samples, expected) {
    const durations = [];
    let bytes = 0;
    // Warm filesystem/database caches. This is explicitly a warm-read benchmark.
    for (let iteration = 0; iteration < samples + 2; iteration += 1) {
        if (global.gc) global.gc();
        const start = performance.now();
        const result = await operation();
        const elapsed = performance.now() - start;
        if (iteration === 0) assert.deepEqual(JSON.parse(result), expected);
        if (iteration >= 2) durations.push(elapsed);
        bytes = Buffer.byteLength(result);
    }
    durations.sort((a, b) => a - b);
    const percentile = (fraction) => durations[Math.ceil(durations.length * fraction) - 1];
    return {
        samples,
        p50Ms: rounded(percentile(0.5)),
        p95Ms: rounded(percentile(0.95)),
        maxMs: rounded(durations[durations.length - 1]),
        responseBytes: bytes
    };
}

async function seed(db, rows, channelCount) {
    await run(db, "PRAGMA journal_mode = WAL");
    await run(db, "CREATE TABLE channels (channel_id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL)");
    await run(db, `CREATE TABLE playlists (
        channel_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
        link TEXT NOT NULL, video_count INTEGER NOT NULL,
        PRIMARY KEY (channel_id, id)
    )`);
    await run(db, "CREATE INDEX playlists_channel_name ON playlists(channel_id, name, id)");
    await run(db, "BEGIN TRANSACTION");
    try {
        for (let channel = 0; channel < channelCount; channel += 1) {
            await run(db, "INSERT INTO channels VALUES (?, ?)", [`dm-${channel}`, updatedAt]);
        }
        // Stay below the older SQLite 999-variable limit; no per-row disk commits.
        for (let offset = 0; offset < rows.length; offset += 100) {
            const batch = rows.slice(offset, offset + 100);
            const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(",");
            await run(db, `INSERT INTO playlists VALUES ${placeholders}`,
                batch.flatMap((row) => [row.channelId, row.id, row.name, row.link, row.count]));
        }
        await run(db, "COMMIT");
    } catch (error) {
        await run(db, "ROLLBACK");
        throw error;
    }
    await run(db, "PRAGMA wal_checkpoint(TRUNCATE)");
}

async function benchmarkDataset(directory, size, channelCount, samples) {
    const rows = Array.from({length: size}, (_, index) => {
        const suffix = String(index).padStart(9, "0");
        return {
            channelId: `dm-${index % channelCount}`,
            id: `PL_fixture_${suffix}`,
            name: `Playlist ${suffix}`,
            link: `https://www.youtube.com/playlist?list=PL_fixture_${suffix}`,
            count: index % 200 + 1
        };
    });
    const buckets = Array.from({length: channelCount}, () => []);
    for (const row of rows) buckets[Number(row.channelId.slice(3))].push(row);
    let totalJsonBytes = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
        const serialized = JSON.stringify(payload(buckets[channel]), null, 4);
        fs.writeFileSync(path.join(directory, `dm-${channel}.json`), serialized);
        totalJsonBytes += Buffer.byteLength(serialized);
    }
    const selected = buckets[0];
    const jsonFile = path.join(directory, "dm-0.json");
    const dbFile = path.join(directory, "cache.sqlite");
    const db = await new Promise((resolve, reject) => {
        const connection = new sqlite3.Database(dbFile, (error) => error ? reject(error) : resolve(connection));
    });
    try {
        const seedStart = performance.now();
        await seed(db, rows, channelCount);
        const sqliteSeedMs = rounded(performance.now() - seedStart);
        const projection = "SELECT name, id, link, video_count AS count FROM playlists WHERE channel_id = ?";
        const readJson = () => JSON.parse(fs.readFileSync(jsonFile, "utf8"));
        const sqlitePayload = async (query, params) => {
            const [result, metadata] = await Promise.all([
                all(db, query, params),
                all(db, "SELECT updated_at FROM channels WHERE channel_id = ?", ["dm-0"])
            ]);
            return JSON.stringify({...payload(result), lastUpdate: metadata[0].updated_at});
        };
        const lookup = selected[Math.floor(selected.length / 2)];
        const deepOffset = Math.max(0, selected.length - pageSize);
        const cases = [
            {
                operation: "full-channel",
                expected: payload(selected),
                json: () => JSON.stringify(readJson()),
                sqlite: () => sqlitePayload(`${projection} ORDER BY name`, ["dm-0"])
            },
            ...[0, deepOffset].map((offset, index) => ({
                operation: index === 0 ? "first-100" : "last-100-offset",
                expected: payload(selected.slice(offset, offset + pageSize)),
                json: () => {
                    const data = readJson();
                    const names = Object.keys(data).filter((name) => name !== "lastUpdate").sort();
                    return JSON.stringify(Object.fromEntries([
                        ["lastUpdate", data.lastUpdate],
                        ...names.slice(offset, offset + pageSize).map((name) => [name, data[name]])
                    ]));
                },
                sqlite: () => sqlitePayload(`${projection} ORDER BY name LIMIT ? OFFSET ?`,
                    ["dm-0", pageSize, offset])
            })),
            {
                operation: "single-playlist",
                expected: {id: lookup.id, link: lookup.link, count: lookup.count},
                json: () => JSON.stringify(readJson()[lookup.name]),
                sqlite: async () => {
                    const result = await all(db,
                        "SELECT id, link, video_count AS count FROM playlists WHERE channel_id = ? AND name = ?",
                        ["dm-0", lookup.name]);
                    return JSON.stringify(result[0]);
                }
            }
        ];
        const measurements = [];
        for (const scenario of cases) {
            for (const store of ["json", "sqlite"]) {
                measurements.push({
                    operation: scenario.operation,
                    store,
                    ...await measure(scenario[store], samples, scenario.expected)
                });
            }
        }
        return {
            totalPlaylists: size,
            channelCount,
            selectedChannelPlaylists: selected.length,
            totalJsonBytes,
            selectedChannelJsonBytes: fs.statSync(jsonFile).size,
            sqliteAllChannelsBytes: fs.statSync(dbFile).size,
            sqliteSeedMs,
            measurements
        };
    } finally {
        await close(db);
    }
}

async function main() {
    const sizeOption = option("sizes", "1000,10000,100000");
    const sizes = sizeOption.split(",").map(Number);
    const samples = Number(option("samples", "15"));
    if (!sizes.length || sizes.some((size) => !Number.isInteger(size) || size < 100 || size > 1000000)) {
        throw new Error("Use --sizes=... with integers from 100 through 1000000.");
    }
    if (!Number.isInteger(samples) || samples < 5 || samples > 200) {
        throw new Error("Use --samples=... with an integer from 5 through 200.");
    }
    const tempRoot = path.resolve(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(tempRoot, "dnd-cache-bench-"));
    const report = {
        generatedAt: new Date().toISOString(),
        environment: {
            node: process.version, platform: process.platform, arch: process.arch,
            cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length,
            sqliteDriver: require("sqlite3/package.json").version
        },
        methodology: "Synthetic warm filesystem reads plus JSON serialization; prototype adapters; no HTTP, browser, live API, refresh concurrency, or durability comparison. JSON uses one file per channel. SQLite uses indexed rows. Samples are serial, with two warmups and optional explicit GC outside timing.",
        datasets: []
    };
    try {
        for (const size of sizes) {
            for (const channelCount of [1, 100]) {
                const datasetDirectory = path.join(directory, `${size}-${channelCount}`);
                fs.mkdirSync(datasetDirectory);
                const result = await benchmarkDataset(datasetDirectory, size, channelCount, samples);
                report.datasets.push(result);
                console.log(`\n${size.toLocaleString()} total lists; ${channelCount} DMs; ${result.selectedChannelPlaylists.toLocaleString()} lists in the selected DM`);
                console.table(result.measurements);
            }
        }
        const output = option("output", "");
        if (output) {
            const destination = path.resolve(output);
            fs.mkdirSync(path.dirname(destination), {recursive: true});
            fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
            console.log(`\nReport: ${destination}`);
        }
    } finally {
        // Only remove the unique temporary directory created by this run.
        const target = path.resolve(directory);
        assert.equal(path.dirname(target), tempRoot);
        assert.ok(path.basename(target).startsWith("dnd-cache-bench-"));
        fs.rmSync(target, {recursive: true, force: true});
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
