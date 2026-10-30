import {test, expect, type Page} from "@playwright/test";
import {catalog, mockCatalogNetwork, startQueuedPlayer} from "./catalog-fixtures";

test.beforeEach(async ({context}) => mockCatalogNetwork(context));

function savedSearch(page: Page, scope = "default") {
    return page.evaluate((scope) => new Promise<{open: boolean; query: string;} | undefined>((resolve, reject) => {
        const request = indexedDB.open("playlist-organizer-ui", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("search", {keyPath: "scope"});
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("search");
            const value = transaction.objectStore("search").get(scope);
            transaction.oncomplete = () => { db.close(); resolve(value.result && {open: value.result.open, query: value.result.query}); };
            transaction.onabort = () => { db.close(); reject(transaction.error); };
        };
    }), scope);
}

test("React search expands below the heading, toggles its active button, and waits 300 ms after the latest edit", async ({page}, testInfo) => {
    await page.emulateMedia({colorScheme: "dark"});
    await page.goto("/react");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await savedSearch(page);
    const now = Date.now();
    await page.clock.install({time: now});
    await page.clock.pauseAt(now + 60000);
    const trigger = page.getByRole("button", {name: "Search playlists", exact: true});
    const closedColor = await trigger.evaluate((element) => getComputedStyle(element).backgroundColor);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await trigger.click();
    const input = page.getByRole("searchbox", {name: "Search playlists"});
    await expect(input).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await trigger.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(closedColor);
    const field = await input.boundingBox();
    const heading = await page.locator("#frameParent h2").boundingBox();
    const player = await page.locator(".player-host").boundingBox();
    expect(field && heading && field.y >= heading.y + heading.height).toBe(true);
    expect(field && player && field.y + field.height <= player.y).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await input.fill("Travel");
    await page.clock.runFor(250);
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await input.fill("Boss");
    await page.clock.runFor(299);
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await page.clock.runFor(1);
    await expect(page.locator("#listParent dt a")).toHaveText(["Boss Battle"]);
    await testInfo.attach("search-inline-dark.png", {body: await page.screenshot({fullPage: true}), contentType: "image/png"});
    await trigger.click();
    await expect(input).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveAttribute("data-filtered", "true");
    await trigger.click();
    await expect(input).toHaveValue("Boss");
    const clear = page.getByRole("button", {name: "Clear search", exact: true});
    await expect(clear).toHaveAttribute("title", "Clear search");
    await expect(clear).toHaveText("");
    await clear.click();
    await page.clock.runFor(300);
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("data-filtered", "false");
});

test("React search preserves playback and filters without fetching another catalog", async ({page}) => {
    let payloads = 0;
    await page.route("**/listCount*", (route) => { payloads += 1; return route.fulfill({json: catalog()}); });
    await page.goto("/react");
    await startQueuedPlayer(page);
    await expect(page.locator("#frameParent h2")).toHaveText("Buffering: Travel / Campfire");
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 1}));
    const before = await page.evaluate(() => (window as any).__playerCalls);
    await page.getByRole("button", {name: "Search playlists", exact: true}).click();
    await page.getByRole("searchbox", {name: "Search playlists"}).fill("Boss");
    await expect(page.locator("#listParent dt a")).toHaveText(["Boss Battle"]);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("searchbox", {name: "Search playlists"})).toBeVisible();
    await expect(page.getByRole("link", {name: "Boss Battle", exact: true})).toBeVisible();
    expect(await page.evaluate(() => (window as any).__playerCalls)).toEqual(before);
    expect(payloads).toBe(1);
    await expect(page.locator("#frameParent h2")).toHaveText("Playing: Travel / Campfire");
});

test("React search stays reachable after mobile scrolling and resets paging without blocking the page", async ({page}, testInfo) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.emulateMedia({colorScheme: "light"});
    const rows = Object.fromEntries(Array.from({length: 150}, (_, index) => ["Playlist " + String(index).padStart(3, "0"), {id: "PL_" + index, link: "fixture", count: 1}]));
    await page.route("**/listCount*", (route) => route.fulfill({json: {...rows, lastUpdate: catalog().lastUpdate}}));
    await page.goto("/react");
    await page.getByRole("button", {name: "Next", exact: true}).click();
    await expect(page.getByRole("navigation", {name: "Playlist pages"})).toContainText("Page 2 of 2");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const trigger = page.getByRole("button", {name: "Search playlists", exact: true});
    await expect(trigger).toHaveClass(/floating/);
    await expect(trigger).toBeInViewport();
    await trigger.click();
    await page.getByRole("searchbox", {name: "Search playlists"}).fill("Playlist");
    await expect(page.locator("nav[aria-label='Playlist pages']")).toContainText("Page 1 of 2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("searchbox", {name: "Search playlists"})).toBeInViewport();
    await testInfo.attach("search-inline-mobile.png", {body: await page.screenshot(), contentType: "image/png"});
    await page.mouse.click(5, 5);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await trigger.click();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
});

test("React restores open and collapsed search text across reloads without mixing channel preferences", async ({page}) => {
    await page.goto("/react");
    const trigger = page.getByRole("button", {name: "Search playlists", exact: true});
    await trigger.click();
    await page.getByRole("searchbox").fill("Boss");
    await expect.poll(() => savedSearch(page)).toEqual({open: true, query: "Boss"});
    await page.reload();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("searchbox")).toHaveValue("Boss");
    await expect(page.locator("#listParent dt a")).toHaveText(["Boss Battle"]);
    await trigger.click();
    await expect.poll(() => savedSearch(page)).toEqual({open: false, query: "Boss"});
    await page.reload();
    await expect(page.locator("#listParent dt a")).toHaveText(["Boss Battle"]);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await page.goto("/react?channelId=UC_other");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await trigger.click();
    await page.getByRole("searchbox").fill("Travel");
    await expect.poll(() => savedSearch(page, "channel:UC_other")).toEqual({open: true, query: "Travel"});
    await page.reload();
    await expect(page.getByRole("searchbox")).toHaveValue("Travel");
    await expect(page.locator("#listParent dt a")).toHaveText(["Travel / Campfire"]);
    await page.goto("/react");
    await expect(page.locator("#listParent dt a")).toHaveText(["Boss Battle"]);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("React search remains usable in memory when IndexedDB is blocked", async ({page}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => { errors.push(error.message); });
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", {get: () => { throw new Error("Storage disabled"); }}));
    await page.goto("/react");
    const trigger = page.getByRole("button", {name: "Search playlists", exact: true});
    await trigger.click();
    await page.getByRole("searchbox").fill("Boss");
    await expect(page.locator("#listParent dt a")).toHaveText(["Boss Battle"]);
    await trigger.click();
    await trigger.click();
    await expect(page.getByRole("searchbox")).toHaveValue("Boss");
    expect(errors).toEqual([]);
});

test("React does not replace new search input with a delayed saved preference", async ({page}) => {
    await page.goto("/health");
    await savedSearch(page);
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("playlist-organizer-ui", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("search", "readwrite");
            transaction.objectStore("search").put({scope: "default", open: false, query: "Travel"});
            transaction.oncomplete = () => { db.close(); resolve(); };
        };
    }));
    await page.addInitScript(() => {
        const original = indexedDB.open.bind(indexedDB);
        const {promise, resolve} = Promise.withResolvers<void>();
        (window as any).__releaseSearchPreferences = resolve;
        indexedDB.open = (name, version) => {
            const request = original(name, version);
            if (name === "playlist-organizer-ui") Object.defineProperty(request, "onsuccess", {
                set(handler: ((this: IDBOpenDBRequest, event: Event) => unknown) | null) {
                    request.addEventListener("success", (event) => { void promise.then(() => handler?.call(request, event)); });
                }
            });
            return request;
        };
    });
    const now = Date.now();
    await page.clock.install({time: now});
    await page.clock.pauseAt(now + 60000);
    await page.goto("/react");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    const trigger = page.getByRole("button", {name: "Search playlists", exact: true});
    await trigger.click();
    await page.getByRole("searchbox").fill("Boss");
    await page.clock.runFor(300);
    await expect(page.locator("#listParent dt a")).toHaveText(["Boss Battle"]);
    await page.evaluate(() => (window as any).__releaseSearchPreferences());
    await expect.poll(() => savedSearch(page)).toEqual({open: true, query: "Boss"});
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("searchbox")).toHaveValue("Boss");
});
