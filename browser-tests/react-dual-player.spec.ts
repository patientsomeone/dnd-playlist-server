import {test, expect, type Page} from "@playwright/test";
import {cacheState, catalog, defaultTime, mockCatalogNetwork, startQueuedPlayer} from "./catalog-fixtures";

test.beforeEach(async ({context}) => mockCatalogNetwork(context));

const first = (page: Page) => page.locator("[data-player-slot='0']");
const second = (page: Page) => page.locator("[data-player-slot='1']");

async function ready(page: Page, index: number, state = 1) {
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations || 0)).toBe(index + 1);
    await page.evaluate((index) => {
        const player = (window as any).__playerInstances[index];
        player.__events.onReady({target: player});
        player.__time = index === 0 ? 137 : 73;
    }, index);
    await expect.poll(() => page.evaluate((index) => (window as any).__playerInstances[index].__calls.some((call: any) => call.method === "loadPlaylist" || call.method === "cuePlaylist"), index)).toBe(true);
    await page.evaluate(({index, state}) => (window as any).__playerInstances[index].__events.onStateChange({data: state}), {index, state});
}

test("Add starts a secondary stream and Hot Swap preserves both iframe instances and pause points", async ({page}) => {
    await page.goto("/react");
    await expect(second(page)).toHaveCount(0);
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    const firstCalls = await page.evaluate(() => (window as any).__playerInstances[0].__calls);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await ready(page, 1);
    await expect(second(page)).toBeVisible();
    await expect(second(page).getByRole("heading")).toHaveText("Secondary · Playing: Boss Battle");
    expect(await page.evaluate(() => (window as any).__playerInstances[0].__calls)).toEqual(firstCalls);
    await expect(page.getByRole("link", {name: "Boss Battle", exact: true})).toHaveAccessibleDescription(/^Secondary player\. Playing/);
    await page.evaluate(() => { (window as any).__originalFrames = Array.from(document.querySelectorAll("#frameParent iframe")); });
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to Boss Battle", exact: true}).click();
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: Boss Battle");
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Paused: Travel / Campfire");
    await expect(first(page)).toHaveAccessibleName("Hot Swapped video player");
    const top = await second(page).boundingBox();
    const lower = await first(page).boundingBox();
    expect(top?.y).toBeLessThan(lower?.y ?? 0);
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to Travel / Campfire", exact: true}).click();
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: Travel / Campfire");
    expect(await page.evaluate(() => {
        const players = (window as any).__playerInstances;
        return {creations: (window as any).__playerCreations, times: players.map((player: any) => player.getCurrentTime()),
            loads: players.map((player: any) => player.__calls.filter((call: any) => call.method === "loadPlaylist").length),
            framesPreserved: Array.from(document.querySelectorAll("#frameParent iframe")).every((frame, index) => frame === (window as any).__originalFrames[index])};
    })).toEqual({creations: 2, times: [137, 73], loads: [1, 1], framesPreserved: true});
    await expect(page.locator("#reactYouTubeApi")).toHaveCount(1);
});

test("secondary controls pause/resume independently and a sole playing secondary moves to the top", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await ready(page, 1);
    await second(page).getByRole("button", {name: "Pause Boss Battle", exact: true}).click();
    await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toHaveAccessibleDescription(/^Playing/);
    await expect(second(page).getByRole("heading")).toHaveText("Secondary · Paused: Boss Battle");
    const pausedColor = await second(page).getByRole("heading").evaluate((element) => getComputedStyle(element).color);
    expect(await page.getByRole("link", {name: "Boss Battle", exact: true}).evaluate((element) => getComputedStyle(element).color)).toBe(pausedColor);
    await expect(second(page).locator(".playback-toggle")).toHaveCSS("color", pausedColor);
    await expect(second(page).locator(".playback-toggle")).toHaveAttribute("data-icon", "play");
    await second(page).getByRole("button", {name: "Resume Boss Battle", exact: true}).click();
    await page.locator(".player-deck > .player-toolbar").getByRole("button", {name: "Pause Travel / Campfire", exact: true}).click();
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: Boss Battle");
    await expect(first(page).getByRole("heading")).toHaveText("Secondary · Paused: Travel / Campfire");
    expect(await first(page).getByRole("heading").evaluate((element) => getComputedStyle(element).color)).toBe(pausedColor);
    expect(await page.getByRole("link", {name: "Boss Battle", exact: true}).evaluate((element) => getComputedStyle(element).color))
        .toBe(await page.locator(".player-deck > .player-toolbar h2").evaluate((element) => getComputedStyle(element).color));
});

test("Hot Swap to a new playlist parks the main and replaces only the secondary", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await ready(page, 1);
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to !!! Intro !!!", exact: true}).click();
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Buffering: !!! Intro !!!");
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Paused: Travel / Campfire");
    expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(2);
    expect(await page.evaluate(() => (window as any).__playerInstances[0].getCurrentTime())).toBe(137);
});

test("pausing while buffering updates immediately and ignores delayed buffering until pause is acknowledged", async ({page}) => {
    await page.goto("/react");
    await startQueuedPlayer(page);
    await page.evaluate(() => { (window as any).__delayPauseEvents = true; });
    const travel = page.getByRole("link", {name: "Travel / Campfire", exact: true});
    await travel.click();
    await expect(travel).toHaveAccessibleDescription("Paused. Activate to resume playback.");
    await page.evaluate(() => (window as any).__playerEvents.onStateChange({data: 3}));
    await expect(page.locator("#frameParent h2")).toHaveText("Paused: Travel / Campfire");
    await travel.click();
    await expect(page.locator("#frameParent h2")).toHaveText("Playing: Travel / Campfire");
});

test("a swapped-out player still awaiting readiness cues its playlist paused", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations || 0)).toBe(1);
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to Boss Battle", exact: true}).click();
    await ready(page, 1);
    await page.evaluate(() => {
        const player = (window as any).__playerInstances[0];
        player.__events.onReady({target: player});
    });
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Paused: Travel / Campfire");
    await expect.poll(() => page.evaluate(() => (window as any).__playerInstances[0].__calls.some((call: any) => call.method === "cuePlaylist"))).toBe(true);
    expect(await page.evaluate(() => (window as any).__playerInstances[0].__calls.some((call: any) => call.method === "loadPlaylist"))).toBe(false);
});

test("favorites stay pinned across reloads and channel scopes without starting either player", async ({page}) => {
    await page.goto("/react");
    const favorite = page.getByRole("button", {name: "Favorite Travel / Campfire", exact: true});
    await favorite.click();
    await expect(page.locator("#listParent dt a")).toHaveText(["Travel / Campfire", "!!! Intro !!!", "Boss Battle"]);
    await expect(page.getByRole("button", {name: "Unfavorite Travel / Campfire", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("#listParent dt a")).toHaveText(["Travel / Campfire", "!!! Intro !!!", "Boss Battle"]);
    expect(await page.evaluate(() => (window as any).__playerCreations || 0)).toBe(0);
    await page.goto("/react?channelId=UC_other");
    await expect(page.locator("#listParent dt a")).toHaveText(["!!! Intro !!!", "Boss Battle", "Travel / Campfire"]);
    await page.goto("/react");
    await expect(page.getByRole("button", {name: "Unfavorite Travel / Campfire", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", {name: "Unfavorite Travel / Campfire", exact: true}).click();
    await page.reload();
    await expect(page.locator("#listParent dt a")).toHaveText(["!!! Intro !!!", "Boss Battle", "Travel / Campfire"]);
});

test("playlist renames retain favorites by ID and favorite buttons remain separate from playback", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("button", {name: "Favorite Travel / Campfire", exact: true}).click();
    const original = catalog();
    const renamed = {...original, "Campfire Renamed": original["Travel / Campfire"], lastUpdate: defaultTime + 1};
    delete (renamed as any)["Travel / Campfire"];
    await page.route("**/listCount*", (route) => route.fulfill({json: renamed}));
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState(defaultTime + 1)}));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", {name: "Unfavorite Campfire Renamed", exact: true})).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#listParent dt a").first()).toHaveText("Campfire Renamed");
    await expect(page.locator("#listParent a[title]")).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__playerCreations || 0)).toBe(0);
});

test("favorites work in memory when IndexedDB is blocked", async ({page}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => Object.defineProperty(window, "indexedDB", {get: () => { throw new Error("Storage denied"); }}));
    await page.goto("/react");
    await page.getByRole("button", {name: "Favorite Boss Battle", exact: true}).click();
    await expect(page.locator("#listParent dt a").first()).toHaveText("Boss Battle");
    await expect(page.getByRole("button", {name: "Unfavorite Boss Battle", exact: true})).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
});

test("a delayed favorites read preserves a newer click and drains its write", async ({page}) => {
    await page.addInitScript(() => {
        const original = indexedDB.open.bind(indexedDB);
        const {promise, resolve} = Promise.withResolvers<void>();
        (window as any).__releaseFavorites = resolve;
        indexedDB.open = (name, version) => {
            const request = original(name, version);
            if (name === "playlist-organizer-favorites") Object.defineProperty(request, "onsuccess", {
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
    await page.getByRole("button", {name: "Favorite Travel / Campfire", exact: true}).click();
    await page.evaluate(() => (window as any).__releaseFavorites());
    await expect(page.getByRole("button", {name: "Unfavorite Travel / Campfire", exact: true})).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open("playlist-organizer-favorites", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("favorites");
            const records = transaction.objectStore("favorites").index("scope").getAll("default");
            transaction.oncomplete = () => { db.close(); resolve(records.result.map((record: {id: string;}) => record.id)); };
        };
    }))).toEqual(["PL_travel"]);
    await expect(page.locator("#listParent dt a").first()).toHaveText("Travel / Campfire");
});

test("secondary autoplay feedback and StrictMode cleanup leave the other stream alone", async ({page}) => {
    await page.goto("/react-test");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await ready(page, 1);
    await page.evaluate(() => (window as any).__playerInstances[1].__events.onAutoplayBlocked({}));
    await expect(second(page).getByRole("status")).toHaveText("Press Play in the video player to start playback.");
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: Travel / Campfire");
    await page.evaluate(() => {
        (window as any).__reactTest.unmount();
        for (const player of (window as any).__playerInstances) {
            player.__events.onReady({target: player});
            player.__events.onStateChange({data: 1});
        }
        (window as any).__reactTest.mount();
    });
    await expect(page.locator("#frameParent h2")).toHaveText("Ready to Play");
    expect(await page.evaluate(() => (window as any).__playerCalls.filter((call: any) => call.method === "destroy").length)).toBe(2);
    await expect(page.locator("#frameParent iframe")).toHaveCount(0);
});

for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
    test(`two players and icon controls fit ${viewport.width}px with green playback styling`, async ({page}, testInfo) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({colorScheme: "dark"});
        await page.goto("/react");
        await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
        await ready(page, 0);
        const add = page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true});
        await add.focus();
        await page.keyboard.press("Enter");
        await ready(page, 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(await page.locator(".player-host").evaluateAll((hosts) => hosts.every((host) =>
            host.getBoundingClientRect().right <= (host.closest("#frameParent")?.getBoundingClientRect().right || 0)))).toBe(true);
        expect(await page.locator(".player-host").evaluateAll((hosts) => hosts.every((host) => host.clientWidth >= 200 && host.clientHeight >= 200))).toBe(true);
        const color = await page.locator(".player-deck > .player-toolbar h2").evaluate((element) => getComputedStyle(element).color);
        expect(color).toBe("rgb(130, 216, 155)");
        expect(await page.getByRole("link", {name: "Travel / Campfire", exact: true}).evaluate((element) => getComputedStyle(element).color)).toBe(color);
        const secondaryColor = await second(page).getByRole("heading").evaluate((element) => getComputedStyle(element).color);
        expect(secondaryColor).toBe("rgb(155, 189, 255)");
        expect(await page.getByRole("link", {name: "Boss Battle", exact: true}).evaluate((element) => getComputedStyle(element).color)).toBe(secondaryColor);
        expect(await page.getByRole("link", {name: "Boss Battle", exact: true}).locator(".playback-badge").evaluate((element) => getComputedStyle(element).color)).toBe(secondaryColor);
        await expect(second(page).locator(".playback-toggle")).toHaveCSS("color", secondaryColor);
        await expect(page.locator(".player-deck > .player-toolbar .playback-toggle")).toHaveCSS("color", color);
        expect(await page.locator(".icon-button").evaluateAll((buttons) => buttons.every((button) => {
            const size = button.getBoundingClientRect();
            return size.width === 44 && size.height === 44;
        }))).toBe(true);
        await expect(page.getByRole("button", {name: "Remove Boss Battle from the player", exact: true})).toHaveAttribute("title", "Remove Boss Battle from the player");
        await page.screenshot({path: `.i.dual-${viewport.width}.png`, fullPage: true});
        await testInfo.attach("dual-players.png", {body: await page.screenshot({fullPage: true}), contentType: "image/png"});
    });
}

test("Add replaces the secondary, Remove clears it, and removing the main promotes the survivor", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await ready(page, 1);
    const originalCalls = await page.evaluate(() => (window as any).__playerInstances[0].__calls);
    await page.getByRole("button", {name: "Add !!! Intro !!! to the secondary player", exact: true}).click();
    await expect(page.getByRole("button", {name: "Remove !!! Intro !!! from the player", exact: true})).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true})).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__playerInstances[1].__calls.filter((call: any) => call.method === "loadPlaylist").length)).toBe(2);
    await page.getByRole("button", {name: "Remove !!! Intro !!! from the player", exact: true}).click();
    await expect(second(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__playerInstances[0].__calls)).toEqual(originalCalls);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await ready(page, 2);
    await page.getByRole("button", {name: "Remove Travel / Campfire from the player", exact: true}).click();
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: Boss Battle");
    await page.getByRole("button", {name: "Remove Boss Battle from the player", exact: true}).click();
    await expect(page.locator("#frameParent h2")).toHaveText("Ready to Play");
    await expect(page.getByText("No Playlist Selected", {exact: true})).toBeVisible();
    await expect(page.locator("#frameParent iframe")).toHaveCount(0);
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 3);
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: Travel / Campfire");
});

test("Remove before readiness prevents late playback, including after a Hot Swap", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerCreations)).toBe(2);
    await page.getByRole("button", {name: "Remove Boss Battle from the player", exact: true}).click();
    await page.evaluate(() => {
        const player = (window as any).__playerInstances[1];
        player.__events.onReady({target: player});
        player.__events.onStateChange({data: 1});
    });
    await expect(second(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__playerInstances[1].__calls.map((call: any) => call.method))).toEqual(["destroy"]);
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to !!! Intro !!!", exact: true}).click();
    await ready(page, 2);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await expect(page.getByRole("button", {name: "Remove Travel / Campfire from the player", exact: true})).toHaveCount(0);
    await expect(page.getByRole("button", {name: "Remove Boss Battle from the player", exact: true})).toBeVisible();
    expect(await page.evaluate(() => (window as any).__playerCreations)).toBe(3);
    await page.getByRole("button", {name: "Remove Boss Battle from the player", exact: true}).click();
    await expect(first(page)).toBeHidden();
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: !!! Intro !!!");
});

test("worded state tags show current activity while rows reverse exclusive swaps", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0, 3);
    const travel = page.getByRole("link", {name: "Travel / Campfire", exact: true}).locator(".playback-badge");
    await expect(travel).toHaveText("Buffering");
    await expect(page.locator("#listParent .playback-state")).toHaveCount(0);
    await travel.click();
    await expect(travel).toHaveText(/Paused$/);
    await travel.click();
    await expect(travel).toHaveText(/Playing$/);
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to Boss Battle", exact: true}).click();
    await ready(page, 1);
    const boss = page.getByRole("link", {name: "Boss Battle", exact: true}).locator(".playback-badge");
    await expect(travel).toHaveText("Secondary · Paused");
    await expect(page.getByRole("link", {name: "Travel / Campfire", exact: true})).toHaveAccessibleDescription(/switch playback/);
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).focus();
    await page.keyboard.press("Enter");
    await expect(travel).toHaveText(/Playing$/);
    await expect(boss).toHaveText(/Paused$/);
    await boss.click();
    await expect(travel).toHaveText(/Paused$/);
    await expect(boss).toHaveText(/Playing$/);
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect(travel).toHaveText(/Playing$/);
    await expect(boss).toHaveText(/Paused$/);
    // Clicking the current row in Hot Swap mode reverses the pair as well.
    await travel.click();
    await expect(travel).toHaveText(/Paused$/);
    await expect(boss).toHaveText(/Playing$/);
    expect(await page.evaluate(() => (window as any).__playerInstances.map((player: any) => player.__calls.filter((call: any) => call.method === "loadPlaylist").length))).toEqual([1, 1]);
    // Direct iframe Play is independent; the row remains a Hot Swap action.
    await page.evaluate(() => (window as any).__playerInstances[0].__events.onStateChange({data: 1}));
    await expect(boss).toHaveText(/Playing$/);
    await expect(travel).toHaveText(/Playing$/);
    await travel.click();
    await expect(boss).toHaveText(/Paused$/);
    await expect(travel).toHaveText(/Playing$/);
});

test("replacement Add shows its swap indicator and returns the deck to independent playback", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to Boss Battle", exact: true}).click();
    await ready(page, 1);
    const add = page.getByRole("button", {name: "Add !!! Intro !!! to the secondary player", exact: true});
    await expect(add).toHaveAttribute("data-icon", "add");
    await expect(add).toHaveAttribute("data-indicator", "swap");
    await expect(add).toHaveAttribute("title", "Replace the secondary player with !!! Intro !!!");
    await add.click();
    await expect.poll(() => page.evaluate(() => (window as any).__playerInstances[0].__calls.filter((call: any) => call.method === "loadPlaylist").at(-1)?.args[0].list)).toBe("PL_intro");
    await page.evaluate(() => (window as any).__playerInstances[0].__events.onStateChange({data: 1}));
    const intro = page.getByRole("link", {name: "!!! Intro !!!", exact: true}).locator(".playback-badge");
    const boss = page.getByRole("link", {name: "Boss Battle", exact: true}).locator(".playback-badge");
    await expect(intro).toHaveText(/Playing$/);
    await expect(boss).toHaveText(/Playing$/);
    await expect(first(page).getByRole("heading")).toHaveText("Secondary · Playing: !!! Intro !!!");
    await expect(first(page)).toHaveAccessibleName("Secondary video player");
    await intro.click();
    await expect(intro).toHaveText(/Paused$/);
    await expect(boss).toHaveText(/Playing$/);
    await intro.click();
    await expect(intro).toHaveText(/Playing$/);
    await expect(boss).toHaveText(/Playing$/);
});

test("Add copies main volume and mute before playback, including zero and reused secondary slots", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.evaluate(() => { (window as any).__playerInstances[0].__volume = 34; });
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await ready(page, 1);
    expect(await page.evaluate(() => {
        const player = (window as any).__playerInstances[1];
        return {volume: player.getVolume(), muted: player.isMuted(), methods: player.__calls.map((call: any) => call.method)};
    })).toEqual({volume: 34, muted: false, methods: ["setVolume", "unMute", "stopVideo", "loadPlaylist", "setShuffle", "setLoop"]});
    await page.evaluate(() => {
        const player = (window as any).__playerInstances[0];
        player.__volume = 0;
        player.__muted = true;
    });
    await page.getByRole("button", {name: "Add !!! Intro !!! to the secondary player", exact: true}).click();
    await expect.poll(() => page.evaluate(() => ({volume: (window as any).__playerInstances[1].getVolume(), muted: (window as any).__playerInstances[1].isMuted()}))).toEqual({volume: 0, muted: true});
    // Subsequent primary volume changes are independent, not continuously synchronized.
    await page.evaluate(() => { (window as any).__playerInstances[0].__volume = 80; });
    expect(await page.evaluate(() => (window as any).__playerInstances[1].getVolume())).toBe(0);
});

test("audio API failure cannot prevent a secondary playlist from loading", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.getByRole("button", {name: "Add Boss Battle to the secondary player", exact: true}).click();
    await expect(page.getByRole("button", {name: "Remove Boss Battle from the player", exact: true})).toBeVisible();
    await page.evaluate(() => { (window as any).__throwAudioMethods = true; });
    await ready(page, 1);
    await expect(second(page).getByRole("heading")).toHaveText("Secondary · Playing: Boss Battle");
    await page.getByRole("button", {name: "Add !!! Intro !!! to the secondary player", exact: true}).click();
    await expect(second(page).getByRole("heading")).toHaveText("Secondary · Buffering: !!! Intro !!!");
});

test("a delayed PLAYING event from the parked player cannot reverse an explicit Hot Swap", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.evaluate(() => { (window as any).__delayPauseEvents = true; });
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to Boss Battle", exact: true}).click();
    await ready(page, 1);
    await page.evaluate(() => (window as any).__playerInstances[0].__events.onStateChange({data: 1}));
    await expect(page.locator(".player-deck > .player-toolbar h2")).toHaveText("Playing: Boss Battle");
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Paused: Travel / Campfire");
    expect(await page.evaluate(() => (window as any).__playerInstances[1].__calls.some((call: any) => call.method === "pauseVideo"))).toBe(false);
});

test("Hot Swap mode headers retain play/pause plus a separate Hot Swap while list rows reverse the pair", async ({page}) => {
    await page.goto("/react");
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await ready(page, 0);
    await page.locator("#listParent").getByRole("button", {name: "Hot Swap to Boss Battle", exact: true}).click();
    await ready(page, 1);
    const toolbar = page.locator(".player-deck > .player-toolbar");
    await expect(toolbar.locator(".playback-toggle")).toHaveAttribute("data-icon", "pause");
    await expect(first(page).locator(".playback-toggle")).toHaveAttribute("data-icon", "play");
    await expect(first(page).getByRole("button", {name: "Hot Swap to Travel / Campfire", exact: true})).toHaveAttribute("data-icon", "swap");
    await toolbar.getByRole("button", {name: "Pause Boss Battle", exact: true}).click();
    await expect(toolbar.getByRole("heading")).toHaveText("Paused: Boss Battle");
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Paused: Travel / Campfire");
    await toolbar.getByRole("button", {name: "Resume Boss Battle", exact: true}).click();
    await expect(toolbar.getByRole("heading")).toHaveText("Playing: Boss Battle");
    await first(page).getByRole("button", {name: "Resume Travel / Campfire", exact: true}).click();
    await expect(toolbar.getByRole("heading")).toHaveText("Playing: Boss Battle");
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Playing: Travel / Campfire");
    await first(page).getByRole("button", {name: "Pause Travel / Campfire", exact: true}).click();
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Paused: Travel / Campfire");
    await expect(toolbar.getByRole("heading")).toHaveText("Playing: Boss Battle");
    await first(page).getByRole("button", {name: "Resume Travel / Campfire", exact: true}).click();
    await page.getByRole("link", {name: "Travel / Campfire", exact: true}).click();
    await expect(toolbar.getByRole("heading")).toHaveText("Playing: Travel / Campfire");
    await expect(second(page).getByRole("heading")).toHaveText("Hot Swapped · Paused: Boss Battle");
    await toolbar.getByRole("button", {name: "Hot Swap players", exact: true}).click();
    await expect(toolbar.getByRole("heading")).toHaveText("Playing: Boss Battle");
    await page.evaluate(() => (window as any).__playerInstances[0].playVideo());
    await expect(first(page).getByRole("heading")).toHaveText("Hot Swapped · Playing: Travel / Campfire");
    await expect(toolbar.getByRole("heading")).toHaveText("Playing: Boss Battle");
    expect(await page.evaluate(() => (window as any).__playerInstances.map((player: any) => player.__calls.filter((call: any) => call.method === "loadPlaylist").length))).toEqual([1, 1]);
});
