import {test, expect} from "@playwright/test";
import {catalog, cacheState, defaultTime, mockCatalogNetwork, seedCatalog, storedCatalog} from "./catalog-fixtures";

test.beforeEach(async ({context}) => mockCatalogNetwork(context));

test("saved React playlists render before a stalled network check and survive an offline reload", async ({page}) => {
    await seedCatalog(page, catalog());
    const {promise, resolve} = Promise.withResolvers<void>();
    let payloads = 0;
    await page.route("**/cacheState*", async (route) => { await promise; await route.fulfill({json: cacheState()}); });
    await page.route("**/listCount*", (route) => { payloads += 1; return route.fulfill({json: catalog()}); });
    try {
        await page.goto("/react");
        await expect(page.locator("#listParent dt a")).toHaveCount(3);
        expect(payloads).toBe(0);
        resolve();
        await expect(page.locator("#catalogStatus")).toBeHidden();
        await page.route("**/cacheState*", (route) => route.abort("failed"));
        await page.reload();
        await expect(page.locator("#listParent dt a")).toHaveCount(3);
        await expect(page.locator("#catalogStatus")).toHaveText("Using saved playlists; updates are unavailable.");
        expect(payloads).toBe(0);
    } finally { resolve(); }
});

for (const failure of ["event", "throw"] as const) {
test(`a failed initial database open (${failure}) recovers persistence for the server snapshot and the next reload`, async ({page}) => {
    await page.addInitScript((failure) => {
        const original = indexedDB.open.bind(indexedDB);
        indexedDB.open = (name, version) => {
            const fail = name === "dnd-playlist-cache" && !sessionStorage.getItem("test-cache-open-failed");
            if (fail) {
                sessionStorage.setItem("test-cache-open-failed", "yes");
                if (failure === "throw") throw new DOMException("Temporary database failure", "UnknownError");
            }
            const request = original(name, version);
            if (fail) {
                Object.defineProperty(request, "onsuccess", {
                    set() {
                        request.addEventListener("success", () => {
                            (window as any).__failCacheOpen = () => {
                                request.result.close();
                                request.onerror?.call(request, new Event("error"));
                            };
                        });
                    }
                });
            }
            return request;
        };
    }, failure);
    let payloads = 0;
    await page.route("**/listCount*", (route) => { payloads += 1; return route.fulfill({json: catalog()}); });
    await page.goto("/react");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    if (failure === "event") {
        await expect.poll(() => page.evaluate(() => typeof (window as any).__failCacheOpen)).toBe("function");
        await page.evaluate(() => (window as any).__failCacheOpen());
    }
    await expect.poll(async () => (await storedCatalog(page))?.lastUpdate).toBe(defaultTime);
    await page.route("**/cacheState*", (route) => route.abort("failed"));
    await page.reload();
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await expect(page.locator("#catalogStatus")).toHaveText("Using saved playlists; updates are unavailable.");
    expect(payloads).toBe(1);
});
}
