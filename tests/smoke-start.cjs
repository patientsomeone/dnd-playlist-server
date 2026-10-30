// Exercise the exact Node entry used by npm start, with fixture environment values.
const {spawn} = require("node:child_process");
const {createServer} = require("node:net");
const {join, resolve, sep, basename} = require("node:path");
const {mkdtemp, rm, readFile} = require("node:fs/promises");
const {tmpdir} = require("node:os");
const assert = require("node:assert/strict");
const {once} = require("node:events");

async function browserSmoke(origin) {
    process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(__dirname, "..", "node_modules", ".cache", "playwright");
    const {chromium, expect} = require("@playwright/test");
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext({serviceWorkers: "block"});
        let lastUpdate = Date.now();
        let catalog = {lastUpdate, Travel: {id: "PL_fixture", link: "https://www.youtube.com/playlist?list=PL_fixture", count: 3}};
        const fakeYouTube = await readFile(join(__dirname, "..", "browser-tests", "fake-youtube.js"), "utf8");
        await context.route("**/*", (route) => {
            const url = new URL(route.request().url());
            if (url.href === "https://www.youtube.com/iframe_api") return route.fulfill({contentType: "application/javascript", body: fakeYouTube});
            if (url.origin !== origin) return route.abort("blockedbyclient");
            if (url.pathname === "/listCount") return route.fulfill({json: catalog});
            if (url.pathname === "/cacheState") return route.fulfill({json: {
                channelId: "UC_fixture", lastUpdate, hasCache: true, locked: false, fresh: true, serverTime: Date.now()
            }});
            if (url.pathname === "/refreshPlaylists") return route.abort("blockedbyclient");
            return route.continue();
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => {errors.push(error.message);});
        await page.goto(origin + "/react");
        await expect(page.getByRole("link", {name: "Travel", exact: true})).toBeVisible();
        // Reproduce a hard reload with unchanged server metadata and aliases left in IndexedDB.
        const seedAliases = () => page.evaluate(({lastUpdate, playlists}) => new Promise((resolve, reject) => {
            const request = indexedDB.open("dnd-playlist-cache", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction("catalogs", "readwrite");
                transaction.objectStore("catalogs").put({scope: "default", channelId: "UC_fixture", lastUpdate,
                    playlists: {"Travel (old)": {...playlists.Travel, count: 44}, ...playlists}});
                transaction.oncomplete = () => {db.close(); resolve();};
                transaction.onabort = () => {db.close(); reject(transaction.error);};
            };
        }), {lastUpdate, playlists: Object.fromEntries(Object.entries(catalog).filter(([name]) => name !== "lastUpdate"))});
        await seedAliases();
        for (const path of ["/react", "/react/"]) {
            const response = await page.goto(origin + path);
            assert.equal(response.status(), 200);
            await expect(page.getByRole("heading", {name: "Ready to Play", exact: true})).toBeVisible();
            await expect(page.getByText("No Playlist Selected", {exact: true})).toBeVisible();
            await expect(page.getByRole("link", {name: "Travel", exact: true})).toBeVisible();
            await expect(page.locator("#listParent dt a")).toHaveCount(1);
            assert.equal((await page.reload()).status(), 200);
            await expect(page.getByRole("link", {name: "Travel", exact: true})).toBeVisible();
        }
        // Verify the real bundle renders IndexedDB data while its server check is stalled.
        const checkGate = Promise.withResolvers();
        const delayCheck = async (route) => { await checkGate.promise; await route.fallback(); };
        await page.route("**/cacheState*", delayCheck);
        try {
            await page.reload();
            await expect(page.getByRole("link", {name: "Travel", exact: true})).toBeVisible();
        } finally { checkGate.resolve(); }
        await expect(page.locator("#catalogStatus")).toBeHidden();
        await page.unroute("**/cacheState*", delayCheck);
        await page.getByRole("link", {name: "Travel", exact: true}).click();
        await expect.poll(() => page.evaluate(() => !!window.__playerEvents)).toBe(true);
        await page.evaluate(() => window.__playerEvents.onReady({target: window.__playerInstances[0]}));
        await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel");
        await expect(page.getByText("No Playlist Selected", {exact: true})).toHaveCount(0);
        await page.evaluate(() => window.__playerEvents.onStateChange({data: 1}));
        await expect(page.locator("#listParent [aria-current]")).toHaveCount(1);
        const calls = await page.evaluate(() => window.__playerCalls);
        assert.ok(calls.some((call) => call.method === "setLoop" && call.args[0]));
        lastUpdate += 1;
        catalog = {...catalog, lastUpdate, Fresh: {id: "PL_new", link: "fixture", count: 1}};
        await page.evaluate(() => window.__playerEvents.onStateChange({data: 2}));
        await expect(page.getByRole("link", {name: "Fresh", exact: true})).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.__playerCalls), calls);
        await expect(page.locator("#frameParent h2")).toHaveText("Paused: Travel");
        await expect(page.getByRole("link", {name: "current player", exact: true})).toHaveCount(0);
        await expect(page.locator("#catalogStatus")).toBeHidden();
        await seedAliases();
        await page.goto(origin + "/");
        await expect(page).toHaveURL(origin + "/");
        await expect(page.getByRole("heading", {name: "Dip's Organized Playlists", exact: true})).toBeVisible();
        await expect(page.getByRole("link", {name: "Travel", exact: true})).toBeVisible();
        await expect(page.locator("#catalogStatus")).toBeHidden();
        await expect(page.getByRole("link", {name: "Travel (old)", exact: true})).toHaveCount(0);
        await expect(page.locator("#listParent dt a")).toHaveCount(2);
        await page.getByRole("link", {name: "Travel", exact: true}).click();
        await expect.poll(() => page.evaluate(() => !!window.__playerEvents)).toBe(true);
        await page.evaluate(() => window.__playerEvents.onReady({}));
        await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel");
        await page.evaluate(() => window.__playerEvents.onStateChange({data: 1}));
        await expect(page.locator("#frameParent h2")).toHaveText("Playing: Travel");
        assert.ok((await page.evaluate(() => window.__playerCalls)).some(call => call.method === "loadPlaylist" && call.args[0].list === "PL_fixture"));
        await page.reload();
        await expect(page.locator("#listParent dt a")).toHaveCount(2);
        await expect(page.getByRole("link", {name: "Travel (old)", exact: true})).toHaveCount(0);
        assert.equal(await page.evaluate(() => window.player), undefined);
        assert.deepEqual(errors, []);
        console.log("Built browser smoke: React and legacy reloads, duplicate IndexedDB aliases, mocked playback/catalog updates, and real routes/assets passed (API fixtures only).");
    } finally {
        await browser.close();
    }
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
