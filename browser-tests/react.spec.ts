import {test, expect} from "@playwright/test";
import {catalog, mockCatalogNetwork} from "./catalog-fixtures";

test.beforeEach(async ({context}) => mockCatalogNetwork(context));

test("the list view rejects duplicate IDs even when raw data bypasses the catalog parser", async ({page}) => {
    await page.goto("/react-test");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await page.evaluate(() => (window as any).__reactTest.renderList({
        "City / Downtime": {id: "PL_city", link: "old", count: 44},
        City: {id: "PL_city", link: "city", count: 35},
        "Other City": {id: "PL_other_city", link: "other", count: 12}
    }, {state: "playing", id: "PL_city", name: "City"}));
    await expect(page.locator("#listParent dt a")).toHaveText(["CityPlaying", "Other City"]);
    await expect(page.locator("#listParent [aria-current]")).toHaveCount(1);
    await expect(page.getByRole("link", {name: "City", exact: true})).toHaveAccessibleDescription("Playing. Activate to pause playback.");
    await expect(page.getByRole("link", {name: "Other City", exact: true})).toHaveAccessibleDescription("Activate to play this playlist.");
    await expect(page.locator("#listParent a[title]")).toHaveCount(0);
});

for (const path of ["/react", "/react/"]) {
    test(`mounts the React client and reloads directly at ${path}`, async ({page}) => {
        const errors: string[] = [];
        const scripts: string[] = [];
        const api: URL[] = [];
        page.on("pageerror", (error) => { errors.push(error.message); });
        page.on("request", (request) => {
            if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
            if (request.url().includes("listCount")) api.push(new URL(request.url()));
        });
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.getByRole("heading", {name: "Ready to Play", exact: true})).toBeVisible();
        expect(await page.locator("#listParent dt a").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("aria-label"))))
            .toEqual(["!!! Intro !!!", "Boss Battle", "Travel / Campfire"]);
        expect(scripts).toContain("/react/assets/main.js");
        expect(scripts).not.toContain("/createList.js");
        const reloaded = await page.reload();
        expect(reloaded?.status()).toBe(200);
        await expect(page.locator("#listParent dt a")).toHaveCount(3);
        expect(api.length).toBe(1); // Reload reuses IndexedDB when the server timestamp is unchanged.
        expect(api.every((url) => url.origin === "http://127.0.0.1:4179" && url.pathname === "/listCount")).toBe(true);
        expect(errors).toEqual([]);
        await expect(page.getByRole("link", {name: "current player", exact: true})).toHaveCount(0);
        await expect(page.locator("#catalogStatus")).toBeHidden();
        await page.goto("/");
        await expect(page).toHaveURL("http://127.0.0.1:4179/");
        await expect(page.getByRole("heading", {name: "Dip's Organized Playlists", exact: true})).toBeVisible();
        await expect(page.locator("#listParent dt a")).toHaveCount(3);
    });
}

test("keeps an explicit channel for API reads and reloads", async ({page}) => {
    const channels: (string | null)[] = [];
    await page.route("**/listCount*", async (route) => {
        channels.push(new URL(route.request().url()).searchParams.get("channelId"));
        await route.fulfill({json: catalog()});
    });
    await page.goto("/react/?channelId=UC_other");
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    await page.reload();
    await expect(page.locator("#listParent dt a")).toHaveCount(3);
    expect(channels.length).toBe(1);
    expect(channels.every((channel) => channel === "UC_other")).toBe(true);
});
