import {test, expect} from "@playwright/test";
import {defaultTime, catalog, cacheState, mockCatalogNetwork, startQueuedPlayer, seedCatalog, storedCatalog} from "./catalog-fixtures";

test.beforeEach(async ({context}) => mockCatalogNetwork(context));

test("renders alphabetic labels and a fresh timestamp without refreshing", async ({page}) => {
    const refreshes: string[] = [];
    page.on("request", (request) => {
        if (request.url().includes("/refreshPlaylists")) refreshes.push(request.url());
    });
    await page.goto("/");
    await expect(page.locator("#listParent dt a")).toHaveText(["!!! Intro !!!", "Boss Battle", "Travel / Campfire"]);
    await expect(page.locator("#lastUpdated")).toHaveClass("fresh");
    expect(refreshes).toEqual([]);
});

for (const source of ["server", "saved"] as const) {
    test(`legacy renders one row per playlist ID from ${source} aliases and selects its own metadata`, async ({page}) => {
        const aliases = {
            lastUpdate: defaultTime,
            "City / Downtime": {id: "PL_city", link: "old-city", count: 44},
            City: {id: "PL_city", link: "city", count: 35},
            "Other City": {id: "PL_other_city", link: "other", count: 10}
        };
        let payloads = 0;
        await page.route("**/listCount*", (route) => { payloads += 1; return route.fulfill({json: aliases}); });
        if (source === "saved") {
            await seedCatalog(page, aliases);
            await page.route("**/cacheState*", (route) => route.abort("failed"));
        }
        await page.goto("/");
        await expect(page.locator("#listParent dt a")).toHaveText(["City", "Other City"]);
        await expect(page.getByRole("link", {name: "City", exact: true})).toHaveAttribute("count", "35");
        const ids = await page.locator("#listParent dt a").evaluateAll((links) => links.map((link) => link.id));
        expect(new Set(ids).size).toBe(2);
        await page.evaluate(() => { Math.random = () => 0.5; });
        await startQueuedPlayer(page, "City");
        await expect(page.locator("#frameParent h2")).toHaveText("Buffering: City");
        expect(await page.evaluate(() => (window as any).__playerCalls)).toContainEqual({
            method: "loadPlaylist", args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_city", index: 17}]
        });
        expect(payloads).toBe(source === "saved" ? 0 : 1);
    });
}

test("legacy replaces a renamed playlist by ID without interrupting playback and persists the new name", async ({page}) => {
    const old = {lastUpdate: defaultTime, "City / Downtime": {id: "PL_city", link: "city", count: 44}};
    await page.route("**/listCount*", (route) => route.fulfill({json: old}));
    await page.goto("/");
    await page.evaluate(() => { Math.random = () => 0.5; });
    await startQueuedPlayer(page, "City / Downtime");
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: City / Downtime");
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await expect(page.locator("#catalogStatus")).toBeHidden();
    const before = await page.evaluate(() => (window as any).__playerCalls);
    const fresh = {lastUpdate: defaultTime + 1, City: {id: "PL_city", link: "city", count: 35}};
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
    await page.route("**/listCount*", (route) => route.fulfill({json: fresh}));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.locator("#listParent dt a")).toHaveText(["City"]);
    await expect(page.getByRole("link", {name: "City", exact: true})).toBeFocused();
    await expect(page.locator("#frameParent h2")).toHaveText("Playing: City / Downtime");
    expect(await page.evaluate(() => (window as any).__playerCalls)).toEqual(before);
    expect(await page.evaluate(() => (window as any).player.getCurrentTime())).toBe(37);
    await expect.poll(async () => (await storedCatalog(page))?.lastUpdate).toBe(defaultTime + 1);
    expect(Object.keys((await storedCatalog(page)).playlists)).toEqual(["City"]);
    await page.getByRole("link", {name: "City", exact: true}).click();
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: City");
    expect(await page.evaluate(() => (window as any).__playerCalls)).toContainEqual({
        method: "loadPlaylist", args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_city", index: 17}]
    });
    await page.reload();
    await expect(page.locator("#listParent dt a")).toHaveText(["City"]);
    expect(await page.evaluate(() => (window as any).player)).toBeUndefined();
});

test("queues selection until the player is ready and shuffles/loops normal playlists", async ({page}) => {
    await page.goto("/");
    await page.evaluate(() => { Math.random = () => 0.6; });
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect.poll(() => page.evaluate(() => !!(window as any).__playerEvents)).toBe(true);
    expect(await page.evaluate(() => (window as any).__playerCalls)).toEqual([]);
    await page.evaluate(() => (window as any).__playerEvents.onReady({}));
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
    expect(await page.evaluate(() => (window as any).__playerCalls)).toContainEqual({
        method: "loadPlaylist",
        args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_travel", index: 6}]
    });
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await expect(page.locator("#frameParent h2")).toHaveText("Playing: Travel / Campfire");
    expect(await page.evaluate(() => (window as any).__playerCalls)).toEqual(expect.arrayContaining([
        {method: "setShuffle", args: [true]}, {method: "setLoop", args: [true]}
    ]));
});

test("Boss playlists start at zero, loop, and do not enable shuffle", async ({page}) => {
    await page.goto("/");
    await startQueuedPlayer(page, "Boss Battle");
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    const calls = await page.evaluate(() => (window as any).__playerCalls);
    expect(calls).toContainEqual({
        method: "loadPlaylist",
        args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_boss", index: 0}]
    });
    expect(calls).toContainEqual({method: "setLoop", args: [true]});
    expect(calls.some((call: any) => call.method === "setShuffle")).toBe(false);
});

test("updates paused/buffering states and skips unavailable videos", async ({page}) => {
    await page.goto("/");
    await startQueuedPlayer(page);
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 2}));
    await expect(page.locator("#frameParent h2")).toHaveText("Paused: Travel / Campfire");
    await expect(page.locator("#frameParent h2")).toHaveClass("paused");
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 3}));
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
    await page.evaluate(() => (window as any).__playerEvents.onError({data: 100}));
    expect(await page.evaluate(() => (window as any).__playerCalls)).toContainEqual({method: "nextVideo", args: []});
});

test("analytics and optional player failures do not interrupt selection or state handling", async ({page}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await startQueuedPlayer(page);
    await page.evaluate(() => {
        (window as any).gtag = () => { throw new Error("Analytics blocked"); };
        (window as any).__throwPlayerMethods = true;
    });
    await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Boss Battle");
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await page.evaluate(() => (window as any).__playerEvents.onError({data: 100}));
    await expect(page.locator("#frameParent h2")).toHaveText("Playing: Boss Battle");
    expect(errors).toEqual([]);
});


test("serves stale data during a background refresh without changing the player heading", async ({page}) => {
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(1, {fresh: false})}));
    await page.route("**/listCount*", (route) => route.fulfill({json: catalog(1)}));
    const {promise: pending, resolve: finish} = Promise.withResolvers<void>();
    await page.route("**/refreshPlaylists*", async (route) => {
        await pending;
        await route.fulfill({json: catalog(defaultTime + 1000)});
    });
    try {
        await page.goto("/");
        await expect(page.locator("#listParent dt a")).toHaveCount(3);
        await expect(page.locator("#catalogStatus")).toBeHidden();
        await expect(page.locator("#frameParent h2")).toHaveText("Ready to Play");
        finish();
        await expect(page.locator("#lastUpdated")).toHaveClass("fresh");
        await expect.poll(async () => (await storedCatalog(page))?.lastUpdate).toBe(defaultTime + 1000);
        expect(await page.evaluate(() => (window as any).player)).toBeUndefined();
    } finally { finish(); }
});

test("polls cacheState while another refresh owns the lease, then downloads the completed catalog", async ({page}) => {
    let checks = 0;
    let refreshes = 0;
    await page.route("**/cacheState*", (route) => {
        checks += 1;
        return route.fulfill({json: checks >= 3 ? cacheState(defaultTime + 1000) : cacheState(1, {fresh: false, locked: checks > 1})});
    });
    await page.route("**/listCount*", (route) => route.fulfill({json: checks >= 3
        ? {...catalog(defaultTime + 1000), New: {id: "PL_new", link: "new", count: 1}} : catalog(1)}));
    await page.route("**/refreshPlaylists*", (route) => {
        refreshes += 1;
        return route.fulfill({json: {status: "processing"}});
    });
    await page.goto("/");
    await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible({timeout: 15000});
    expect(refreshes).toBe(1);
    expect(checks).toBe(3);
    await expect(page.locator("#frameParent h2")).toHaveText("Ready to Play");
});

test("handles an empty catalog without creating playlist links", async ({page}) => {
    await page.route("**/listCount*", (route) => route.fulfill({json: {lastUpdate: defaultTime}}));
    await page.goto("/");
    await expect(page.locator("#lastUpdated")).toHaveClass("fresh");
    await expect(page.locator("#listParent dt a")).toHaveCount(0);
});

test("renders labels that sort after lastUpdate and renders markup as plain text", async ({page}) => {
    const label = "<img src=x onerror=alert(1)>";
    await page.route("**/listCount*", (route) => route.fulfill({json: {
        ...catalog(), zither: {id: "PL_zither", link: "zither", count: 1},
        [label]: {id: "PL_text", link: "javascript:alert(1)", count: 1}
    }}));
    await page.goto("/");
    await expect(page.getByRole("link", {name: "zither", exact: true})).toBeVisible();
    await expect(page.getByRole("link", {name: label, exact: true})).toHaveAttribute("href", "https://www.youtube.com/playlist?list=PL_text");
    await expect(page.locator("#listParent img")).toHaveCount(0);
});


for (const failure of ["HTTP", "JSON"]) {
    test("an initial " + failure + " failure shows a retry and recovers", async ({page}) => {
        let failed = true;
        await page.route("**/listCount*", (route) => failed
            ? route.fulfill(failure === "HTTP" ? {status: 503, body: "Unavailable"} : {status: 200, body: "not JSON"})
            : route.fulfill({json: catalog()}));
        await page.goto("/");
        await expect(page.getByRole("alert")).toBeVisible();
        failed = false;
        await page.getByRole("button", {name: "Retry", exact: true}).click();
        await expect(page.locator("#listParent dt a")).toHaveCount(3);
        await expect(page.getByRole("alert")).toHaveCount(0);
    });
}

test("renders IndexedDB before a slow cacheState response and applies the newer catalog later", async ({page}) => {
    await seedCatalog(page, catalog(1));
    const {promise: pending, resolve: finish} = Promise.withResolvers<void>();
    let payloads = 0;
    await page.route("**/cacheState*", async (route) => {
        await pending;
        await route.fulfill({json: cacheState(defaultTime + 1000)});
    });
    await page.route("**/listCount*", (route) => {
        payloads += 1;
        return route.fulfill({json: {...catalog(defaultTime + 1000), New: {id: "PL_new", link: "new", count: 1}}});
    });
    try {
        await page.goto("/");
        await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toBeVisible();
        expect(payloads).toBe(0);
        finish();
        await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible();
        expect(payloads).toBe(1);
    } finally { finish(); }
});

test("persists a downloaded catalog and reloads it when API requests are unavailable", async ({page}) => {
    await page.goto("/");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await expect.poll(async () => (await storedCatalog(page))?.lastUpdate).toBe(defaultTime);
    await page.route("**/cacheState*", (route) => route.abort("failed"));
    await page.route("**/listCount*", (route) => route.abort("failed"));
    await page.reload();
    await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toBeVisible();
    await expect(page.locator("#catalogStatus")).toBeHidden();
    await expect(page.getByRole("button", {name: "Retry", exact: true})).toBeHidden();
    await startQueuedPlayer(page);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
});

test("works in memory when access to IndexedDB throws", async ({page}) => {
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", {
        get: () => { throw new Error("Storage disabled"); }
    }));
    await page.goto("/");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await startQueuedPlayer(page);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
});

test("resolves a selection against refreshed metadata before loading the player", async ({page}) => {
    await page.goto("/");
    await startQueuedPlayer(page);
    await page.evaluate(() => { Math.random = () => 0.6; });
    const {promise: pending, resolve: finish} = Promise.withResolvers<void>();
    await page.route("**/cacheState*", async (route) => {
        await pending;
        await route.fulfill({json: cacheState(defaultTime + 1000)});
    });
    const fresh: any = catalog(defaultTime + 1000);
    delete fresh["Travel / Campfire"];
    fresh["Evening Campfire"] = {id: "PL_travel", link: "travel", count: 3};
    await page.route("**/listCount*", (route) => route.fulfill({json: fresh}));
    try {
        await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
        await expect(page.locator("#catalogStatus")).toBeHidden();
        finish();
        await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Evening Campfire");
        const calls = await page.evaluate(() => (window as any).__playerCalls);
        expect(calls.filter((call: any) => call.method === "loadPlaylist")).toHaveLength(2);
        expect(calls.at(-1)).toEqual({
            method: "loadPlaylist", args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_travel", index: 1}]
        });
        expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    } finally { finish(); }
});

for (const [state, title] of [[2, "Paused"], [3, "Buffering"]] as const) {
    test("a " + title.toLowerCase() + " event updates only catalog data while playback is active", async ({page}) => {
        await page.goto("/");
        await startQueuedPlayer(page);
        await page.evaluate(() => {
            (window as any).__playerEvents.onStateChange({data: 1});
            (window as any).__originalPlayer = (window as any).player;
        });
        const before = await page.evaluate(() => (window as any).__playerCalls);
        await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1000)}));
        await page.route("**/listCount*", (route) => route.fulfill({json: {
            ...catalog(defaultTime + 1000), New: {id: "PL_new", link: "new", count: 1}
        }}));
        await page.evaluate((state) => (window as any).__playerEvents.onStateChange({data: state}), state);
        await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible();
        expect(await page.evaluate(() => (window as any).__playerCalls)).toEqual(before);
        expect(await page.evaluate(() => (window as any).player === (window as any).__originalPlayer)).toBe(true);
        expect(await page.evaluate(() => (window as any).player.getCurrentTime())).toBe(37);
        await expect(page.locator("#frameParent h2")).toHaveText(title + ": Travel / Campfire");
    });
}

test("a removed selection leaves current playback alone and asks the user to choose again", async ({page}) => {
    await page.goto("/");
    await startQueuedPlayer(page);
    const before = await page.evaluate(() => (window as any).__playerCalls);
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1000)}));
    const fresh: any = catalog(defaultTime + 1000);
    delete fresh["Boss Battle"];
    await page.route("**/listCount*", (route) => route.fulfill({json: fresh}));
    await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
    await expect(page.locator("#catalogStatus")).toHaveText("That playlist is no longer available. Please choose another.");
    expect(await page.evaluate(() => (window as any).__playerCalls)).toEqual(before);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
});

test("unchanged versions use metadata checks without downloading the whole catalog on interactions", async ({page}) => {
    let payloads = 0;
    await page.route("**/listCount*", (route) => { payloads += 1; return route.fulfill({json: catalog()}); });
    await page.goto("/");
    await startQueuedPlayer(page);
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 2}));
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 3}));
    await expect(page.locator("#catalogStatus")).toBeHidden();
    expect(payloads).toBe(1);
});

test("explicit channels keep separate IndexedDB records from the default channel", async ({page}) => {
    await seedCatalog(page, catalog(1));
    await page.route("**/listCount*", (route) => route.fulfill({json: {
        lastUpdate: defaultTime, Other: {id: "PL_other", link: "other", count: 2}
    }}));
    await page.goto("/?channelId=UC_other");
    await expect(page.getByRole("link", {name: "Other", exact: true})).toBeVisible();
    await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toHaveCount(0);
    await expect.poll(async () => (await storedCatalog(page, "channel:UC_other"))?.channelId).toBe("UC_other");
    expect((await storedCatalog(page)).lastUpdate).toBe(1);
});

test("another tab picks up a committed browser cache update without creating a player", async ({context, page}) => {
    await page.goto("/");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    const second = await context.newPage();
    await second.goto("/");
    await expect(second.locator("#listParent dt a")).toHaveCount(3);
    await context.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1000)}));
    await context.route("**/listCount*", (route) => route.fulfill({json: {
        ...catalog(defaultTime + 1000), New: {id: "PL_new", link: "new", count: 1}
    }}));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible();
    await expect(second.getByRole("link", {name: "New", exact: true})).toBeVisible();
    expect(await page.evaluate(() => (window as any).player)).toBeUndefined();
    expect(await second.evaluate(() => (window as any).player)).toBeUndefined();
});

test("recovers from a malformed IndexedDB catalog", async ({page}) => {
    await seedCatalog(page, {lastUpdate: defaultTime + 1000, Invalid: {id: "PL_bad", link: "bad", count: "not a count"}});
    await page.goto("/");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await expect.poll(async () => (await storedCatalog(page))?.lastUpdate).toBe(defaultTime);
    expect((await storedCatalog(page)).playlists.Invalid).toBeUndefined();
});

test("an older in-flight response cannot overwrite a newer IndexedDB catalog from another tab", async ({context, page}) => {
    await seedCatalog(page, catalog(1));
    const {promise: pending, resolve: finish} = Promise.withResolvers<void>();
    await page.route("**/listCount*", async (route) => {
        await pending;
        await route.fulfill({json: catalog()});
    });
    try {
        await page.goto("/");
        await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toBeVisible();
        const writer = await context.newPage();
        await seedCatalog(writer, {lastUpdate: defaultTime + 1000, Winner: {id: "PL_winner", link: "winner", count: 1}});
        finish();
        await expect(page.getByRole("link", {name: "Winner", exact: true})).toBeVisible();
        expect((await storedCatalog(page)).lastUpdate).toBe(defaultTime + 1000);
    } finally { finish(); }
});
