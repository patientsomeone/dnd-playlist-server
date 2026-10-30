const {test, expect} = require("@playwright/test");
const assert = require("node:assert/strict");
const {readFile} = require("node:fs/promises");
const {join} = require("node:path");

test("built React and legacy clients preserve cached catalogs and playback", async ({context, page}) => {
    const origin = process.env.BUILT_CLIENT_ORIGIN;
    assert.ok(origin, "Run through npm run test:client to start the fixture server");
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
    const errors = [];
    page.on("pageerror", (error) => {errors.push(error.message);});
    console.log("Built client: loading React and seeding IndexedDB aliases");
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
    console.log("Built client: verifying cached React reloads");
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
    console.log("Built client: verifying saved data during a stalled server check");
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
    console.log("Built client: verifying React playback and catalog updates");
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
    console.log("Built client: verifying legacy playback and reloads");
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
});
