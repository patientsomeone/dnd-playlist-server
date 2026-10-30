import {test, expect} from "@playwright/test";
import {cacheState, defaultTime, mockCatalogNetwork} from "./catalog-fixtures";
import {writeFile} from "node:fs/promises";
import {resolve, dirname} from "node:path";
import {cpus} from "node:os";

test("React bounds a 100,000-playlist catalog, searches and pages without another payload", async ({context, page}, testInfo) => {
    test.setTimeout(60000);
    await mockCatalogNetwork(context);
    const playlists: Record<string, {id: string; link: string; count: number;}> = {};
    for (let index = 0; index < 100000; index += 1) {
        playlists["Playlist " + String(index).padStart(6, "0")] = {id: "PL_" + index, link: "fixture", count: 5};
    }
    let payloads = 0;
    await page.route("**/cacheState*", (route) => route.fulfill({json: cacheState()}));
    await page.route("**/listCount*", (route) => { payloads += 1; return route.fulfill({json: {...playlists, lastUpdate: defaultTime}}); });
    const started = performance.now();
    await page.goto("/react");
    await expect(page.locator("#listParent dt a")).toHaveCount(100, {timeout: 30000});
    const initialMs = performance.now() - started;
    await expect(page.getByRole("navigation", {name: "Playlist pages"})).toContainText("Page 1 of 1000");
    const pagingStart = performance.now();
    await page.getByRole("button", {name: "Next", exact: true}).click();
    await expect(page.getByRole("link", {name: "Playlist 000100", exact: true})).toBeVisible();
    const pageMs = performance.now() - pagingStart;
    await page.getByRole("button", {name: "Search playlists", exact: true}).click();
    const searchStart = performance.now();
    await page.getByRole("searchbox", {name: "Search playlists"}).fill("Playlist 099999");
    await expect(page.locator("#listParent dt a")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", {name: "Playlist 099999", exact: true})).toBeVisible();
    const searchMs = performance.now() - searchStart;
    expect(payloads).toBe(1);
    await expect(page.locator("#reactYouTubeApi")).toHaveCount(0);
    const result = {
        recordedAt: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model,
        playlists: 100000, renderedPageSize: 100, initialMs, pageMs, searchMs, payloads,
        userAgent: await page.evaluate(() => navigator.userAgent), note: "Synthetic mocked API, includes browser automation and the 300 ms search debounce; not an HTTP capacity measurement."
    };
    const body = JSON.stringify(result, null, 2) + "\n";
    await testInfo.attach("react-catalog-scale.json", {contentType: "application/json", body});
    if (process.env.REACT_BENCHMARK_OUTPUT) {
        const target = resolve(process.env.REACT_BENCHMARK_OUTPUT);
        if (dirname(target) !== resolve(__dirname, "../benchmarks/results")) throw new Error("Benchmark output must stay in benchmarks/results");
        await writeFile(target, body);
    }
});
