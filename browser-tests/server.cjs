// Snapshot actual legacy/client bundles in memory. All API calls must be mocked.
// This fixture never imports the app, loads environment files, or reads its cache.
const {createServer} = require("node:http");
const {readFileSync} = require("node:fs");
const {join, basename} = require("node:path");
const {build} = require("esbuild");

async function main() {
    const [legacy, client] = await Promise.all([
        build({...require("../bin/createListBuild.cjs"), write: false}),
        build({...require("../bin/clientBuild.cjs"), write: false, minify: true, define: {"process.env.NODE_ENV": '"production"'}})
    ]);
    const harness = await build({...require("../bin/clientBuild.cjs"), entryPoints: [], write: false,
        stdin: {contents: "import {StrictMode} from \"react\"; import {createRoot} from \"react-dom/client\"; import {ReactLists} from \"./client/src/ReactLists\"; import PlayLister from \"./client/src/components/Playlister\"; let root; window.__reactTest = {mount() { root = createRoot(document.getElementById(\"root\")); root.render(<StrictMode><ReactLists/></StrictMode>); }, renderList(playlists, playback) { root.render(<PlayLister playlists={playlists} playback={playback} query=\"\" page={0} onPageChange={() => {}} onSelect={() => {}}/>); }, unmount() { root.unmount(); root = undefined; }}; window.__reactTest.mount();", resolveDir: join(__dirname, ".."), loader: "tsx"},
        define: {"process.env.NODE_ENV": '"development"'}});
    const assets = new Map();
    const type = (name) => name.endsWith(".map") ? "application/json" : name.endsWith(".css") ? "text/css" : "application/javascript";
    for (const file of legacy.outputFiles) assets.set("/" + basename(file.path), [file.contents, type(file.path)]);
    for (const file of client.outputFiles) assets.set("/react/assets/" + basename(file.path), [file.contents, type(file.path)]);
    for (const [url, name, mime] of [
        ["/", "playlists.html", "text/html"], ["/pageStyle.css", "pageStyle.css", "text/css"], ["/favicon.ico", "favicon.ico", "image/x-icon"]
    ]) assets.set(url, [readFileSync(join(__dirname, "..", "public", name)), mime]);
    for (const file of harness.outputFiles) assets.set("/__react-test/assets/" + basename(file.path), [file.contents, type(file.path)]);
    assets.set("/react-test", ['<div id="root"></div><script type="module" src="/__react-test/assets/stdin.js"></script>', "text/html"]);
    const html = readFileSync(join(__dirname, "..", "client", "index.html"));
    assets.set("/react", [html, "text/html"]);
    assets.set("/react/", [html, "text/html"]);
    createServer((request, response) => {
        const path = new URL(request.url, "http://127.0.0.1:4179").pathname;
        if (path === "/health") return response.writeHead(200).end("fixture server");
        const asset = assets.get(path);
        if (!asset) return response.writeHead(path.startsWith("/react/") ? 404 : 500).end("Unmocked test endpoint");
        response.writeHead(200, {"Content-Type": asset[1]});
        response.end(asset[0]);
    }).listen(4179, "127.0.0.1");
}

main().catch((error) => {console.error(error); process.exitCode = 1;});
