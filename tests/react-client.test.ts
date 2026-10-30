import express from "express";
import {createServer, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import {mkdtemp, mkdir, writeFile, rm, unlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve, dirname, basename} from "node:path";
import {createReactClientRouter} from "../src/routes/reactClient";

describe("scoped React client routing", () => {
    let directory: string;
    let server: Server;
    let origin: string;
    const html = "<!doctype html><div id=\"root\"></div><script type=\"module\" src=\"/react/assets/main.js\"></script>";

    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "dnd-react-route-"));
        await mkdir(join(directory, "assets"));
        await writeFile(join(directory, "index.html"), html);
        await writeFile(join(directory, "assets", "main.js"), "console.log(\"fixture client\");");
        await writeFile(join(directory, "private.sqlite"), "fixture private data");
        await writeFile(join(directory, "assets", ".env"), "fixture private config");
        const app = express();
        app.use("/react", createReactClientRouter(directory));
        app.get("/cacheState", (_request, response) => { response.json({fixture: true}); });
        app.use((_request, response) => { response.status(404).type("text").send("outer fallback"); });
        server = createServer(app);
        await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
        origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterEach(async () => {
        server.closeAllConnections();
        await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
        const target = resolve(directory);
        if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("dnd-react-route-")) {
            throw new Error("Unexpected React route test cleanup path");
        }
        await rm(target, {recursive: true, force: true});
    });

    test.each(["/react", "/react/", "/react?channelId=UC_fixture"])("serves the client HTML directly at %s", async (path) => {
        const response = await fetch(origin + path);
        expect(response.status).toBe(200);
        expect(response.redirected).toBe(false);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(await response.text()).toBe(html);
    });

    test("serves revalidated JavaScript only from the asset directory", async () => {
        const response = await fetch(origin + "/react/assets/main.js");
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toMatch(/javascript/);
        expect(response.headers.get("cache-control")).toContain("max-age=0");
        expect(await response.text()).toContain("fixture client");
    });

    test.each(["/react/assets/missing.js", "/react/assets/", "/react/unknown", "/react/index.html", "/react/private.sqlite",
        "/react/assets/.env", "/react/cacheState"])("returns 404 rather than HTML or private data for %s", async (path) => {
        const response = await fetch(origin + path);
        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toContain("text/plain");
        expect(await response.text()).toBe("This is not the page you are looking for...");
    });

    test("supports HEAD without sending an HTML body", async () => {
        const response = await fetch(origin + "/react", {method: "HEAD"});
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).toBe("");
    });

    test("keeps root API paths and similarly named paths outside the client mount", async () => {
        expect(await (await fetch(origin + "/cacheState")).json()).toEqual({fixture: true});
        const response = await fetch(origin + "/reactive");
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("outer fallback");
    });

    test("returns a controlled unavailable response when the client has not been built", async () => {
        await unlink(join(directory, "index.html"));
        const response = await fetch(origin + "/react");
        expect(response.status).toBe(503);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).toBe("The playlist preview is temporarily unavailable.");
    });
});
