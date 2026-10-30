// Exercise the exact Node entry used by npm start, with fixture environment values.
const {spawn} = require("node:child_process");
const {createServer} = require("node:net");
const {join, resolve, sep, basename} = require("node:path");
const {mkdtemp, rm} = require("node:fs/promises");
const {tmpdir} = require("node:os");
const assert = require("node:assert/strict");
const {once} = require("node:events");

async function browserSmoke(origin) {
    const runner = spawn(process.execPath, [require.resolve("@playwright/test/cli"), "test",
        "--config", join(__dirname, "built-client.config.cjs")], {
        cwd: join(__dirname, ".."), windowsHide: true, stdio: "inherit",
        env: {...process.env, BUILT_CLIENT_ORIGIN: origin}
    });
    const [code, signal] = await once(runner, "exit");
    assert.equal(code, 0, `Built-client browser smoke failed (exit ${code}, signal ${signal})`);
}

async function main() {
    const directory = await mkdtemp(join(tmpdir(), "dnd-start-smoke-"));
    const listener = createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const port = listener.address().port;
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    const child = spawn(process.execPath, [join(__dirname, "..", "dist", "server", "routes", "app.js")], {
        cwd: directory,
        windowsHide: true,
        env: {...process.env, PORT: String(port), DO_ENV: "test", YT_LIST_OWNER: "UC_fixture", YT_API_KEY: "fixture-key",
            PLAYLIST_CACHE_DB_PATH: join(directory, "cache.sqlite")},
        stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const exited = once(child, "exit");
    try {
        const deadline = Date.now() + 15000;
        while (!output.includes(`Listening on port ${port}`)) {
            if (child.exitCode !== null || Date.now() > deadline) {
                throw new Error(`Built server did not start: ${output}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const origin = `http://127.0.0.1:${port}`;
        const html = await fetch(origin, {signal: AbortSignal.timeout(5000)});
        assert.equal(html.status, 200);
        assert.match(await html.text(), /Dip's Organized Playlists/);
        const bundle = await fetch(`${origin}/createList.js`, {signal: AbortSignal.timeout(5000)});
        assert.equal(bundle.status, 200);
        for (const path of ["/react", "/react/", "/react?channelId=UC_fixture"]) {
            const preview = await fetch(origin + path, {signal: AbortSignal.timeout(5000)});
            assert.equal(preview.status, 200);
            assert.equal(preview.redirected, false);
            assert.equal(preview.headers.get("cache-control"), "no-store");
            assert.match(await preview.text(), /src="\/react\/assets\/main.js"/);
        }
        const client = await fetch(`${origin}/react/assets/main.js`, {signal: AbortSignal.timeout(5000)});
        assert.equal(client.status, 200);
        assert.match(client.headers.get("content-type"), /javascript/);
        assert.ok((await client.text()).length > 0);
        for (const path of ["/react/assets/missing.js", "/react/unknown", "/react/index.html", "/react/server/routes/app.js",
            "/react/data/playlist-cache.sqlite", "/react/assets/.env"]) {
            const response = await fetch(origin + path, {signal: AbortSignal.timeout(5000)});
            assert.equal(response.status, 404);
            assert.match(response.headers.get("content-type"), /text\/plain/);
        }
        const state = await fetch(`${origin}/cacheState`, {signal: AbortSignal.timeout(5000)});
        assert.equal(state.status, 200);
        assert.equal(state.headers.get("cache-control"), "no-store");
        const metadata = await state.json();
        assert.equal(metadata.channelId, "UC_fixture");
        assert.equal(metadata.lastUpdate, null);
        assert.equal(metadata.locked, false);
        const missing = await fetch(`${origin}/fixture-missing-route`, {signal: AbortSignal.timeout(5000)});
        assert.equal(missing.status, 404);
        if (process.argv.includes("--browser")) await browserSmoke(origin);
        console.log("Built server: legacy page/bundle, React routes/assets, scoped 404s, and isolated SQLite cacheState passed.");
    } finally {
        if (child.exitCode === null) child.kill();
        await exited;
        const target = resolve(directory);
        if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("dnd-start-smoke-")) {
            throw new Error("Unexpected startup smoke cleanup path");
        }
        await rm(target, {recursive: true, force: true, maxRetries: 3});
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
