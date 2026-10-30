const {rm, mkdir, copyFile, writeFile} = require("node:fs/promises");
const {resolve, dirname, join} = require("node:path");
const {spawnSync} = require("node:child_process");
const esbuild = require("esbuild");
const root = resolve(__dirname, "..");

function typecheck(project, emit = false) {
    const result = spawnSync(process.execPath, [require.resolve("typescript/lib/tsc.js"), "--project", project,
        ...(emit ? [] : ["--noEmit"])], {cwd: root, stdio: "inherit", windowsHide: true});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${project} failed (${result.status})`);
}

async function cleanOutput(name) {
    const output = resolve(root, "dist", name);
    if (!["server", "client"].includes(name) || dirname(output) !== join(root, "dist")) {
        throw new Error("Unexpected build output directory");
    }
    await rm(output, {recursive: true, force: true});
}

async function copyClientHtml() {
    await mkdir(join(root, "dist", "client"), {recursive: true});
    await copyFile(join(root, "client", "index.html"), join(root, "dist", "client", "index.html"));
}

async function buildTarget(target) {
    if (target === "server") {
        await cleanOutput("server");
        typecheck("tsconfig.server.json", true);
    } else if (target === "legacy") {
        typecheck("tsconfig.legacy.json");
        const result = await esbuild.build(require("./createListBuild.cjs"));
        await mkdir(join(root, "dist", "build-info"), {recursive: true});
        await writeFile(join(root, "dist", "build-info", "legacy.json"), JSON.stringify(result.metafile, null, 2) + "\n");
    } else if (target === "client") {
        typecheck("tsconfig.client.json");
        await cleanOutput("client");
        const result = await esbuild.build({...require("./clientBuild.cjs"), define: {"process.env.NODE_ENV": '"production"'}, minify: true});
        await copyClientHtml();
        await mkdir(join(root, "dist", "build-info"), {recursive: true});
        await writeFile(join(root, "dist", "build-info", "client.json"), JSON.stringify(result.metafile, null, 2) + "\n");
    } else {
        throw new Error(`Unknown build target: ${target}`);
    }
}

module.exports = {root, typecheck, cleanOutput, copyClientHtml, buildTarget};
