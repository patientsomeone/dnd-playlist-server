import {test, expect, type Page} from "@playwright/test";
import {catalog, cacheState, defaultTime, mockCatalogNetwork, seedCatalog, storedCatalog} from "./catalog-fixtures";

test.beforeEach(async ({context}) => mockCatalogNetwork(context));

async function ready(page: Page) {
    await expect.poll(() => page.evaluate(() => !!(window as any).__playerEvents)).toBe(true);
    await page.evaluate(() => {
        const fixture = window as any;
        fixture.__playerEvents.onReady({target: fixture.__playerInstances.at(-1)});
    });
    await expect(page.locator("#frameParent h2")).toHaveText(/^Buffering:/);
}

async function start(page: Page, name = "Travel / Campfire") {
    const previous = await page.evaluate(() => (window as any).__playerCreations || 0);
    await page.getByRole("link", {name, exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations || 0)).toBe(previous + 1);
    await ready(page);
}

test("React polls a processing refresh without starting a player or duplicating the import", async ({page}) => {
    let checks = 0;
    let refreshes = 0;
    await page.route("**/cacheState*", (route) => {
        checks += 1;
        return route.fulfill({json: checks >= 3 ? cacheState(defaultTime + 1) : cacheState(1, {fresh: false, locked: checks > 1})});
    });
    await page.route("**/listCount*", (route) => route.fulfill({json: checks >= 3
        ? {...catalog(defaultTime + 1), New: {id: "PL_new", link: "new", count: 1}} : catalog(1)}));
    await page.route("**/refreshPlaylists*", (route) => { refreshes += 1; return route.fulfill({json: {status: "processing"}}); });
    await page.goto("/react");
    await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible({timeout: 15000});
    expect(refreshes).toBe(1);
    expect(checks).toBe(3);
    await expect(page.locator("#frameParent h2")).toHaveText("Ready to Play");
});

for (const source of ["server", "saved"] as const) {
    test(`React removes duplicate IDs from ${source} catalogs and highlights only one row through refresh`, async ({page}) => {
        const duplicates = {
            lastUpdate: defaultTime,
            "City / Downtime": {id: "PL_city", link: "old", count: 44},
            City: {id: "PL_city", link: "city", count: 35},
            "Other City": {id: "PL_other_city", link: "other", count: 44}
        };
        await page.route("**/listCount*", (route) => route.fulfill({json: duplicates}));
        if (source === "saved") await seedCatalog(page, duplicates);
        await page.goto("/react");
        await expect(page.locator("#listParent dt a")).toHaveText(["City", "Other City"]);
        await start(page, "City");
        await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
        await expect(page.locator("#listParent [aria-current]")).toHaveCount(1);
        await expect(page.getByRole("link", {name: "City", exact: true})).toHaveAccessibleDescription("Playing. Activate to pause playback.");
        const before = await calls(page);
        await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
        await page.route("**/listCount*", (route) => route.fulfill({json: {...duplicates, lastUpdate: defaultTime + 1}}));
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect.poll(async () => (await storedCatalog(page))?.lastUpdate).toBe(defaultTime + 1);
        await expect(page.locator("#listParent dt a")).toHaveCount(2);
        await expect(page.locator("#listParent [aria-current]")).toHaveCount(1);
        expect(await calls(page)).toEqual(before);
    });
}

test("React keeps playlist positions stable through slow selection checks and offline feedback", async ({page}) => {
    await page.goto("/react");
    await start(page);
    const positions = () => page.locator("#listParent dt a").evaluateAll((anchors) => anchors.map((anchor) => {
        const {y, height} = anchor.getBoundingClientRect();
        return {y, height};
    }));
    const before = await positions();
    const {promise, resolve} = Promise.withResolvers<void>();
    await page.route("**/cacheState*", async (route) => { await promise; await route.fulfill({json: cacheState()}); });
    try {
        await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
        await expect(page.locator("#catalogStatus")).toHaveText("Loading latest playlists...");
        expect(await positions()).toEqual(before);
        resolve();
        await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Boss Battle");
        expect(await positions()).toEqual(before);
        await page.route("**/cacheState*", (route) => route.abort("failed"));
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect(page.locator("#catalogStatus")).toHaveText("Using saved playlists; updates are unavailable.");
        await expect(page.getByRole("button", {name: "Retry", exact: true})).toBeVisible();
        expect(await positions()).toEqual(before);
    } finally { resolve(); }
});

test("React and legacy tabs share updated catalogs without sharing or changing playback", async ({context, page}) => {
    await page.goto("/react");
    await start(page);
    const before = await calls(page);
    const other = await context.newPage();
    await other.goto("/");
    await expect(other.locator("#listParent dt a")).toHaveCount(3);
    await context.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
    await context.route("**/listCount*", (route) => route.fulfill({json: {...catalog(defaultTime + 1), New: {id: "PL_new", link: "new", count: 1}}}));
    await other.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(other.getByRole("link", {name: "New", exact: true})).toBeVisible();
    await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible();
    expect(await calls(page)).toEqual(before);
    expect(await other.evaluate(() => (window as any).player)).toBeUndefined();
});

function calls(page: Page) {
    return page.evaluate(() => (window as any).__playerCalls as {method: string; args: any[];}[]);
}

test("React active playlist pauses/resumes immediately by mouse and keyboard while metadata is slow", async ({page}) => {
    await page.goto("/react");
    await start(page);
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await expect(page.locator("#catalogStatus")).toBeHidden();
    const before = await calls(page);
    const {promise, resolve} = Promise.withResolvers<void>();
    await page.route("**/cacheState*", async (route) => { await promise; await route.fulfill({json: cacheState()}); });
    try {
        const travel = page.getByRole("link", {name: "Travel / Campfire", exact: true});
        await travel.click();
        await expect(travel).toHaveAccessibleDescription("Paused. Activate to resume playback.");
        await expect(page.locator("#frameParent h2")).toHaveText("Paused: Travel / Campfire");
        await page.keyboard.press("Enter");
        await expect(travel).toHaveAccessibleDescription("Playing. Activate to pause playback.");
        await expect(page.locator("#frameParent h2")).toHaveText("Playing: Travel / Campfire");
        expect((await calls(page)).slice(before.length)).toEqual([{method: "pauseVideo", args: []}, {method: "playVideo", args: []}]);
        expect(await page.evaluate(() => (window as any).__playerInstances[0].getCurrentTime())).toBe(37);
        expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    } finally { resolve(); }
});

test("React toggles buffering, resumes cued/ended/blocked playback, and retries failed controls", async ({page}) => {
    await page.goto("/react");
    await start(page);
    await page.evaluate(() => {
        (window as any).__playerEvents.onStateChange({data: 1});
        (window as any).__playerEvents.onStateChange({data: 3});
    });
    const travel = page.getByRole("link", {name: "Travel / Campfire", exact: true});
    await travel.click();
    await expect(travel).toHaveAccessibleDescription("Paused. Activate to resume playback.");
    for (const state of [-1, 0, 5]) {
        await page.evaluate((data) => (window as any).__playerEvents.onStateChange({data}), state);
        const before = await calls(page);
        await travel.click();
        await expect(travel).toHaveAccessibleDescription("Playing. Activate to pause playback.");
        expect((await calls(page)).slice(before.length)).toEqual([{method: "playVideo", args: []}]);
    }
    await page.evaluate(() => (window as any).__playerEvents.onAutoplayBlocked({}));
    await travel.click();
    await expect(travel).toHaveAccessibleDescription("Playing. Activate to pause playback.");
    await expect(page.getByText("Press Play in the video player to start playback.", {exact: true})).toHaveCount(0);
    await page.evaluate(() => { (window as any).__throwPlayerMethods = true; });
    await travel.click();
    await expect(page.getByRole("alert")).toHaveText("Unable to change playback. Select this playlist again to retry.");
    const beforeRetry = (await calls(page)).length;
    await page.evaluate(() => { (window as any).__throwPlayerMethods = false; });
    await travel.click();
    await expect(travel).toHaveAccessibleDescription("Buffering. Activate to toggle playback.");
    expect((await calls(page)).slice(beforeRetry).map((call) => call.method)).toEqual(["stopVideo", "loadPlaylist"]);
});

test("React active-row toggles cancel a pending different selection without reloading playback", async ({page}) => {
    await page.goto("/react");
    await start(page);
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await expect(page.locator("#catalogStatus")).toBeHidden();
    const before = await calls(page);
    const {promise, resolve} = Promise.withResolvers<void>();
    await page.route("**/cacheState*", async (route) => { await promise; await route.fulfill({json: cacheState()}); });
    try {
        await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
        await expect(page.locator("#catalogStatus")).toHaveText("Loading latest playlists...");
        await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
        await expect(page.locator("#frameParent h2")).toHaveText("Paused: Travel / Campfire");
        resolve();
        await expect(page.locator("#catalogStatus")).toBeHidden();
        expect((await calls(page)).slice(before.length)).toEqual([{method: "pauseVideo", args: []}]);
        await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toHaveAttribute("aria-current", "true");
    } finally { resolve(); }
});

for (const colorScheme of ["light", "dark"] as const) {
    test(`React active playlist follows playback with text and matching colors in ${colorScheme} mode`, async ({page}, testInfo) => {
        await page.emulateMedia({colorScheme});
        await page.goto("/react");
        const links = page.locator("#listParent dt a");
        await expect(links).toHaveText(["!!! Intro !!!", "Boss Battle", "Travel / Campfire"]);
        await expect(page.locator("#listParent [aria-current]")).toHaveCount(0);
        await expect(page.locator("#listParent .video-count, #listParent [data-count]")).toHaveCount(0);
        await start(page);
        const travel = page.getByRole("link", {name: "Travel / Campfire", exact: true});
        await expect(travel).toHaveAttribute("aria-current", "true");
        await expect(travel).toHaveAccessibleDescription("Buffering. Activate to toggle playback.");
        const colors: string[] = [];
        for (const [event, state, label] of [[1, "playing", "Playing"], [2, "paused", "Paused"], [3, "buffering", "Buffering"]] as const) {
            await page.evaluate((data) => (window as any).__playerEvents.onStateChange({data}), event);
            await expect(travel).toHaveAttribute("data-playback-state", state);
            await expect(travel).toHaveAccessibleDescription(new RegExp("^" + label + "\\."));
            await expect(page.locator("#frameParent h2")).toHaveText(label + ": Travel / Campfire");
            const color = await travel.evaluate((element) => getComputedStyle(element).color);
            colors.push(color);
            await expect(page.locator("#frameParent h2")).toHaveCSS("color", color);
            await expect(travel).toHaveCSS("border-color", color);
            if (state === "paused") await testInfo.attach("active-playlist-" + colorScheme + ".png", {body: await page.screenshot({fullPage: true}), contentType: "image/png"});
        }
        expect(new Set(colors).size).toBe(3);
        const before = await calls(page);
        await page.getByRole("button", {name: "Search playlists", exact: true}).click();
        const search = page.getByRole("searchbox", {name: "Search playlists"});
        await search.fill("Boss");
        await expect(page.locator("#listParent [aria-current]")).toHaveCount(0);
        await search.fill("");
        await expect(travel).toHaveAttribute("aria-current", "true");
        await page.keyboard.press("Escape");
        expect(await calls(page)).toEqual(before);
        await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
        await expect(page.locator("#listParent [aria-current]")).toHaveCount(1);
        await expect(travel).not.toHaveAttribute("aria-current");
        await expect(page.getByRole("link", {name: "Boss Battle", exact: true})).toHaveAccessibleDescription("Buffering. Activate to toggle playback.");
        expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    });
}

test("React shows saved IndexedDB data before a slow server check, then adopts the newer catalog", async ({page}) => {
    await seedCatalog(page, catalog(1));
    const {promise, resolve} = Promise.withResolvers<void>();
    let payloads = 0;
    await page.route("**/cacheState*", async (route) => { await promise; await route.fulfill({json: cacheState(defaultTime + 1)}); });
    await page.route("**/listCount*", (route) => {
        payloads += 1;
        return route.fulfill({json: {...catalog(defaultTime + 1), New: {id: "PL_new", link: "new", count: 1}}});
    });
    try {
        await page.goto("/react");
        await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toBeVisible();
        expect(payloads).toBe(0);
        resolve();
        await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible();
        expect(payloads).toBe(1);
        expect(await page.locator("#reactYouTubeApi").count()).toBe(0);
    } finally { resolve(); }
});

test("React persists catalogs and keeps playback selection usable offline", async ({page}) => {
    await page.goto("/react");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await expect.poll(async () => (await storedCatalog(page))?.lastUpdate).toBe(defaultTime);
    await page.route("**/cacheState*", (route) => route.abort("failed"));
    await page.reload();
    await expect(page.locator("#catalogStatus")).toHaveText("Using saved playlists; updates are unavailable.");
    await start(page);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
});

test("React works in memory with blocked storage, reports initial errors, and retries", async ({page}) => {
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", {get: () => { throw new Error("Storage disabled"); }}));
    let failed = true;
    await page.route("**/listCount*", (route) => route.fulfill(failed ? {status: 503} : {json: catalog()}));
    await page.goto("/react");
    await expect(page.getByRole("alert")).toHaveText("Unable to load playlists. Please retry.");
    failed = false;
    await page.getByRole("button", {name: "Retry", exact: true}).click();
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await start(page);
});

test("React handles empty catalogs and renders hostile labels only as text", async ({page}) => {
    await page.route("**/listCount*", (route) => route.fulfill({json: {lastUpdate: defaultTime}}));
    await page.goto("/react");
    await expect(page.getByText("No playlists found for this channel.", {exact: true})).toBeVisible();
    await expect(page.locator("#listParent dt a")).toHaveCount(0);
    const label = "<img src=x onerror=alert(1)>";
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
    await page.route("**/listCount*", (route) => route.fulfill({json: {
        lastUpdate: defaultTime + 1, [label]: {id: "PL_text", link: "javascript:alert(1)", count: 1}
    }}));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("link", {name: label, exact: true})).toHaveAttribute("href", "https://www.youtube.com/playlist?list=PL_text");
    await expect(page.locator("#listParent img")).toHaveCount(0);
});

test("React queues the latest selection and reuses one player and API script", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
    expect(await calls(page)).toEqual([]);
    await ready(page);
    expect((await calls(page)).filter((call) => call.method === "loadPlaylist")).toEqual([{
        method: "loadPlaylist", args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_boss", index: 0}]
    }]);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Boss Battle");
    expect(await page.locator("#reactYouTubeApi").count()).toBe(1);
    expect(await page.evaluate(() => (window as any).player)).toBeUndefined();
});

test("React randomizes normal playlists, loops, disables shuffle for Boss, and skips unavailable videos", async ({page}) => {
    await page.goto("/react");
    await page.evaluate(() => { Math.random = () => 0.6; });
    await start(page);
    expect(await calls(page)).toContainEqual({method: "loadPlaylist", args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_travel", index: 6}]});
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await expect(page.locator("#frameParent h2")).toHaveText("Playing: Travel / Campfire");
    expect(await calls(page)).toEqual(expect.arrayContaining([{method: "setShuffle", args: [true]}, {method: "setLoop", args: [true]}]));
    await page.evaluate(() => (window as any).__playerEvents.onAutoplayBlocked({}));
    await expect(page.getByText("Press Play in the video player to start playback.", {exact: true})).toBeVisible();
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    await expect(page.getByText("Press Play in the video player to start playback.", {exact: true})).toHaveCount(0);
    await page.evaluate(() => { (window as any).gtag = () => { throw new Error("Analytics blocked"); }; });
    await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Boss Battle");
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    expect((await calls(page)).filter((call) => call.method === "setShuffle").at(-1)).toEqual({method: "setShuffle", args: [false]});
    await page.evaluate(() => (window as any).__playerEvents.onError({data: 100}));
    expect(await calls(page)).toContainEqual({method: "nextVideo", args: []});
    expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(1);
});

for (const [state, title] of [[2, "Paused"], [3, "Buffering"]] as const) {
    test(`React ${title.toLowerCase()} metadata updates preserve the player, position, and call history`, async ({page}) => {
        await page.goto("/react");
        await start(page);
        await page.evaluate(() => {
            (window as any).__playerEvents.onStateChange({data: 1});
            (window as any).__originalPlayer = (window as any).__playerInstances[0];
        });
        const before = await calls(page);
        await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
        await page.route("**/listCount*", (route) => route.fulfill({json: {...catalog(defaultTime + 1), New: {id: "PL_new", link: "new", count: 1}}}));
        await page.evaluate((state) => (window as any).__playerEvents.onStateChange({data: state}), state);
        await expect(page.getByRole("link", {name: "New", exact: true})).toBeVisible();
        expect(await calls(page)).toEqual(before);
        expect(await page.evaluate(() => (window as any).__playerInstances[0] === (window as any).__originalPlayer)).toBe(true);
        expect(await page.evaluate(() => (window as any).__originalPlayer.getCurrentTime())).toBe(37);
        await expect(page.locator("#frameParent h2")).toHaveText(title + ": Travel / Campfire");
        await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toHaveAttribute("aria-current", "true");
        await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toHaveAccessibleDescription(new RegExp("^" + title + "\\."));
    });
}

test("React resolves fresh names/counts before explicit selection without losing keyboard focus", async ({page}) => {
    await page.goto("/react");
    await start(page, "Boss Battle");
    await page.evaluate(() => { Math.random = () => 0.6; });
    const {promise, resolve} = Promise.withResolvers<void>();
    await page.route("**/cacheState*", async (route) => { await promise; await route.fulfill({json: cacheState(defaultTime + 1)}); });
    const fresh: any = catalog(defaultTime + 1);
    delete fresh["Travel / Campfire"];
    fresh["Evening Campfire"] = {id: "PL_travel", link: "travel", count: 3};
    await page.route("**/listCount*", (route) => route.fulfill({json: fresh}));
    try {
        await page.getByRole("link", {name: "Travel / Campfire", exact: true}).focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#catalogStatus")).toHaveText("Loading latest playlists...");
        await expect(page.getByRole("link", {name: "Boss Battle", exact: true})).toHaveAttribute("aria-current", "true");
        resolve();
        await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Evening Campfire");
        await expect(page.getByRole("link", {name: "Evening Campfire", exact: true})).toBeFocused();
        await expect(page.getByRole("link", {name: "Evening Campfire", exact: true})).toHaveAttribute("aria-current", "true");
        await expect(page.getByRole("link", {name: "Evening Campfire", exact: true})).toHaveAccessibleDescription("Buffering. Activate to toggle playback.");
        expect((await calls(page)).filter((call) => call.method === "loadPlaylist").at(-1))
            .toEqual({method: "loadPlaylist", args: [{listType: "playlist", suggestedQuality: "hd720", list: "PL_travel", index: 1}]});
    } finally { resolve(); }
});

test("React revalidates queued selection at actual player readiness", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
    const fresh: any = catalog(defaultTime + 1);
    delete fresh["Travel / Campfire"];
    fresh["Fresh Campfire"] = {id: "PL_travel", link: "travel", count: 1};
    await page.route("**/listCount*", (route) => route.fulfill({json: fresh}));
    await ready(page);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Fresh Campfire");
    expect((await calls(page)).find((call) => call.method === "loadPlaylist")?.args[0].index).toBe(0);
});

test("React leaves current playback alone when a selected playlist has been removed", async ({page}) => {
    await page.goto("/react");
    await start(page);
    const before = await calls(page);
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
    const fresh: any = catalog(defaultTime + 1);
    delete fresh["Boss Battle"];
    await page.route("**/listCount*", (route) => route.fulfill({json: fresh}));
    await page.getByRole("link", {name: "Boss Battle", exact: true}).click();
    await expect(page.locator("#catalogStatus")).toHaveText("That playlist is no longer available. Please choose another.");
    expect(await calls(page)).toEqual(before);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
});

test("React retries an API script failure without leaving an unhandled error", async ({page}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => { errors.push(error.message); });
    let requests = 0;
    await page.route("https://www.youtube.com/iframe_api", (route) => ++requests === 1 ? route.abort("failed") : route.fallback());
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect(page.getByRole("alert")).toHaveText("The video player could not load. Select a playlist to retry.");
    await start(page);
    expect(requests).toBe(2);
    expect(errors).toEqual([]);
});

test("React retires a player that never becomes ready and ignores its late callback", async ({page}) => {
    await page.clock.install();
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    await page.evaluate(() => { (window as any).__oldEvents = (window as any).__playerEvents; });
    await page.clock.fastForward(15000);
    await expect(page.getByRole("alert")).toHaveText("The video player did not become ready. Select a playlist to retry.");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations)).toBe(2);
    await page.evaluate(() => (window as any).__oldEvents.onReady({target: (window as any).__playerInstances[0]}));
    expect((await calls(page)).filter((call) => call.method === "loadPlaylist")).toHaveLength(0);
    await ready(page);
    expect((await calls(page)).filter((call) => call.method === "destroy")).toHaveLength(1);
    expect((await calls(page)).filter((call) => call.method === "loadPlaylist")).toHaveLength(1);
});

test("React StrictMode cleans up playback and remounts without stale events or duplicate refresh", async ({page}) => {
    let refreshed = false;
    let refreshes = 0;
    await page.route("**/cacheState*", (route) => route.fulfill({json: refreshed ? cacheState() : cacheState(null)}));
    await page.route("**/refreshPlaylists*", (route) => { refreshes += 1; refreshed = true; return route.fulfill({json: catalog()}); });
    await page.goto("/react-test");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    expect(refreshes).toBe(1);
    await start(page);
    await page.evaluate(() => {
        (window as any).__oldEvents = (window as any).__playerEvents;
        (window as any).__reactTest.unmount();
        (window as any).__oldEvents.onStateChange({data: 1});
        (window as any).__reactTest.mount();
    });
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await expect(page.locator("#frameParent h2")).toHaveText("Ready to Play");
    expect((await calls(page)).filter((call) => call.method === "destroy")).toHaveLength(1);
    await start(page);
    expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(2);
    expect(refreshes).toBe(1);
    await expect(page.locator("#frameParent iframe")).toHaveCount(1);
});

test("React unmount during API loading cannot create a late player", async ({page}) => {
    const {promise, resolve} = Promise.withResolvers<void>();
    await page.route("https://www.youtube.com/iframe_api", async (route) => { await promise; await route.fallback(); });
    try {
        await page.goto("/react-test");
        await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
        await expect(page.locator("#reactYouTubeApi")).toHaveCount(1);
        await page.evaluate(() => (window as any).__reactTest.unmount());
        resolve();
        await expect.poll(() => page.evaluate(() => !!(window as any).YT?.Player)).toBe(true);
        expect(await page.evaluate(() => (window as any).__playerCreations || 0)).toBe(0);
        await page.evaluate(() => (window as any).__reactTest.mount());
        await start(page);
        expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(1);
    } finally { resolve(); }
});

test("React keeps its layout within a mobile viewport and supports keyboard selection", async ({page}, testInfo) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).focus();
    await page.keyboard.press("Enter");
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", {name: "Search playlists", exact: true})).toBeVisible();
    await expect(page.getByRole("searchbox", {name: "Search playlists"})).toHaveCount(0);
    await testInfo.attach("react-mobile.png", {body: await page.screenshot({fullPage: true}), contentType: "image/png"});
});
