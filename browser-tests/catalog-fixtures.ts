import {readFileSync} from "node:fs";
import {join} from "node:path";
import {test, expect, type Page, type BrowserContext} from "@playwright/test";
import cachedPlaylists from "../tests/fixtures/cached-playlists.json";

export const defaultChannel = "UC_fixture_default";
export const defaultTime = Date.now();
export const catalog = (lastUpdate = defaultTime) => ({...cachedPlaylists, lastUpdate});
export const cacheState = (lastUpdate: number | null = defaultTime, extra: Record<string, any> = {}) => ({
    channelId: defaultChannel, lastUpdate, hasCache: lastUpdate !== null, locked: false, fresh: lastUpdate !== null && lastUpdate > 1, serverTime: Date.now(), ...extra
});

export const fakeYouTube = readFileSync(join(__dirname, "fake-youtube.js"), "utf8");


export async function mockCatalogNetwork(context: BrowserContext): Promise<void> {
    await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === "http://127.0.0.1:4179") return route.continue();
        if (url.href === "https://www.youtube.com/iframe_api") return route.fulfill({contentType: "application/javascript", body: fakeYouTube});
        if (url.hostname === "www.googletagmanager.com" || url.hostname.endsWith("google-analytics.com")) return route.fulfill({status: 204});
        return route.abort("blockedbyclient");
    });
    await context.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime, {channelId: new URL(route.request().url()).searchParams.get("channelId") || defaultChannel})}));
    await context.route("**/listCount*", (route) => route.fulfill({json: catalog()}));
}

export async function startQueuedPlayer(page: Page, name = "Travel / Campfire"): Promise<void> {
    await page.getByRole("link", {name, exact: true}).click();
    await expect.poll(() => page.evaluate(() => !!(window as any).__playerEvents)).toBe(true);
    await page.evaluate(() => (window as any).__playerEvents.onReady({}));
}

export async function seedCatalog(page: Page, body: any, scope = "default", channelId = defaultChannel): Promise<void> {
    await page.goto("/health");
    await page.evaluate(async ({body, scope, channelId}) => {
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open("dnd-playlist-cache", 1);
            request.onupgradeneeded = () => request.result.createObjectStore("catalogs", {keyPath: "scope"});
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction("catalogs", "readwrite");
                transaction.objectStore("catalogs").put({scope, channelId, lastUpdate: body.lastUpdate, playlists: Object.fromEntries(Object.entries(body).filter(([key]) => key !== "lastUpdate"))});
                transaction.oncomplete = () => { db.close(); resolve(); };
                transaction.onabort = () => { db.close(); reject(transaction.error); };
            };
        });
    }, {body, scope, channelId});
}

export async function storedCatalog(page: Page, scope = "default"): Promise<any> {
    return page.evaluate((scope) => new Promise<any>((resolve, reject) => {
        const request = indexedDB.open("dnd-playlist-cache", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("catalogs");
            const entry = transaction.objectStore("catalogs").get(scope);
            transaction.oncomplete = () => { db.close(); resolve(entry.result); };
            transaction.onabort = () => { db.close(); reject(transaction.error); };
        };
    }), scope);
}
