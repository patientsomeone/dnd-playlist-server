// Real builds and watchers in a disposable checkout; never touch the live cache.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {spawn, spawnSync} = require("node:child_process");
const {createServer} = require("node:net");
const {once} = require("node:events");
const root = path.resolve(__dirname, "..");
const digest = async (file) => createHash("sha256").update(await fs.readFile(file)).digest("hex");

async function until(check, description) {
    const deadline = Date.now() + 20000;
    while (!await check()) {
        if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function watchSmoke(fixture) {
    const listener = createServer().listen(0, "127.0.0.1");
    await once(listener, "listening");
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    const child = spawn(process.execPath, [path.join(fixture, "bin", "dev.cjs")], {
        cwd: fixture, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
        env: {...process.env, PORT: String(port), YT_LIST_OWNER: "UC_fixture", YT_API_KEY: "fixture-key", DO_ENV: "test",
            PLAYLIST_CACHE_DB_PATH: path.join(fixture, "data", "watch.sqlite")}
    });
    const exited = once(child, "exit");
    let output = "";
    child.stdout.on("data", (chunk) => {output += chunk;});
    child.stderr.on("data", (chunk) => {output += chunk;});
    try {
        await until(() => {
            if (child.exitCode !== null) throw new Error(output);
            return output.includes(`Listening on port ${port}`);
        }, "dev startup");
        assert.equal((output.match(/Built client browser bundle/g) || []).length, 1);
        assert.equal((output.match(/Built legacy browser bundle/g) || []).length, 1);
        const clientScript = path.join(fixture, "dist", "client", "assets", "main.js");
        const before = await digest(clientScript);
        await fs.appendFile(path.join(fixture, "client", "src", "main.tsx"), '\nconsole.log("client-watch-fixture");\n');
        await until(async () => await digest(clientScript) !== before, "client rebuild");
        assert.equal((output.match(/Listening on port/g) || []).length, 1, "Client edits must not restart the API");
        await fs.appendFile(path.join(fixture, "client", "index.html"), "\n<!-- html-watch-fixture -->\n");
        await until(async () => (await fs.readFile(path.join(fixture, "dist", "client", "index.html"), "utf8"))
            .includes("html-watch-fixture"), "client HTML copy");
        await fs.appendFile(path.join(fixture, "src", "routes", "app.ts"), '\nconsole.log("api-watch-fixture");\n');
        await until(() => (output.match(/Listening on port/g) || []).length === 2, "API restart");
        const response = await fetch(`http://127.0.0.1:${port}/cacheState`, {signal: AbortSignal.timeout(5000)});
        assert.equal(response.status, 200);
        assert.equal((await response.json()).channelId, "UC_fixture");
    } finally {
        if (child.exitCode === null && child.signalCode === null) {
            if (process.platform === "win32") {
                spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {stdio: "ignore", windowsHide: true});
            } else child.kill("SIGTERM");
        }
        await exited;
    }
}

async function main() {
    const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "dnd-build-isolation-"));
    const modules = path.join(fixture, "node_modules");
    const file = (...parts) => path.join(fixture, ...parts);
    try {
        for (const name of ["src", "client", "bin"]) {
            await fs.cp(path.join(root, name), file(name), {recursive: true,
                filter: async (source) => (await fs.stat(source)).isDirectory() || /\.(?:tsx?|cjs|html|css)$/.test(source)});
        }
        for (const name of await fs.readdir(root)) {
            if (/^tsconfig.*\.json$/.test(name) || ["package.json", "nodemon.json"].includes(name)) {
                await fs.copyFile(path.join(root, name), file(name));
            }
        }
        await fs.symlink(path.join(root, "node_modules"), modules, process.platform === "win32" ? "junction" : "dir");
        const sentinels = ["public/json/keep.json", "public/locks/keep.lock", "data/private.sqlite", ".i.env"];
        for (const name of [...sentinels, "dist/server/obsolete.js", "dist/client/obsolete.js"]) {
            await fs.mkdir(path.dirname(file(name)), {recursive: true});
            await fs.writeFile(file(name), `fixture-${name}`);
        }
        const protectedHashes = await Promise.all(sentinels.map((name) => digest(file(name))));
        for (const name of ["playlists.html", "pageStyle.css", "favicon.ico"]) {
            await fs.copyFile(path.join(root, "public", name), file("public", name));
        }
        const build = (target, success = true) => {
            const result = spawnSync(process.execPath, [file("bin", "build.cjs"), target], {
                cwd: fixture, windowsHide: true, encoding: "utf8", timeout: 120000
            });
            if (result.error) throw result.error;
            if (success) assert.equal(result.status, 0, result.stdout + result.stderr);
            else assert.notEqual(result.status, 0, "Invalid source must fail the build");
        };
        const preserved = async () => assert.deepEqual(await Promise.all(sentinels.map((name) => digest(file(name)))), protectedHashes);
        build("all");
        for (const name of ["server", "client"]) {
            await assert.rejects(fs.access(file("dist", name, "obsolete.js")), {code: "ENOENT"});
        }
        await assert.rejects(fs.access(file("dist/server/agents/createList.js")), {code: "ENOENT"});
        await assert.rejects(fs.access(file("dist/server/client/catalogSync.js")), {code: "ENOENT"});
        const server = file("dist/server/routes/app.js");
        const client = file("dist/client/assets/main.js");
        const legacy = file("public/createList.js");
        const hashes = await Promise.all([server, client, legacy].map(digest));
        build("client");
        assert.equal(await digest(server), hashes[0]);
        assert.equal(await digest(legacy), hashes[2]);
        build("server");
        assert.equal(await digest(client), hashes[1]);
        assert.equal(await digest(legacy), hashes[2]);
        build("legacy");
        assert.equal(await digest(server), hashes[0]);
        assert.equal(await digest(client), hashes[1]);
        await preserved();
        const {build: bundle} = require("esbuild");
        const forbidden = file("client/src/forbidden.ts");
        await fs.writeFile(forbidden, 'import "../../src/utilities/environment";\n');
        await assert.rejects(bundle({...require(file("bin/clientBuild.cjs")), entryPoints: [forbidden],
            write: false, logLevel: "silent"}), /Server source is unavailable in browser builds/);
        await fs.writeFile(forbidden, 'import catalog from "../../public/json/keep.json"; console.log(catalog);\n');
        await assert.rejects(bundle({...require(file("bin/clientBuild.cjs")), entryPoints: [forbidden],
            write: false, logLevel: "silent"}), /Server source is unavailable in browser builds/);
        await fs.unlink(forbidden);
        for (const name of ["client", "legacy"]) {
            const graph = JSON.parse(await fs.readFile(file("dist/build-info", `${name}.json`), "utf8"));
            assert.equal(Object.keys(graph.inputs).some((input) => /src\/(?:utilities|routes|helpers)\//.test(input)), false);
        }
        await watchSmoke(fixture);
        await fs.writeFile(file("src/invalid-build.ts"), 'const value: number = "fixture type error";\n');
        const browserHashes = await Promise.all([client, legacy].map(digest));
        build("all", false);
        await assert.rejects(fs.access(server), {code: "ENOENT"});
        assert.deepEqual(await Promise.all([client, legacy].map(digest)), browserHashes);
        await preserved();
        console.log("Build isolation passed: independent outputs, preserved cache files, browser boundary, failure propagation, and dev watches.");
    } finally {
        // Unlink the dependency junction before recursively deleting only this fixture.
        await fs.unlink(modules).catch((error) => {if (error.code !== "ENOENT") throw error;});
        const target = path.resolve(fixture);
        if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("dnd-build-isolation-")) {
            throw new Error("Unexpected build-test cleanup path");
        }
        await fs.rm(target, {recursive: true, force: true, maxRetries: 3});
    }
}

main().catch((error) => {console.error(error); process.exitCode = 1;});
