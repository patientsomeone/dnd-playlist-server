require("./require-runtime.cjs");
const {spawn, spawnSync} = require("node:child_process");
const {root} = require("./buildTargets.cjs");
const {watchBrowsers} = require("./watchBrowsers.cjs");

async function main() {
    const dispose = await watchBrowsers();
    const server = spawn(process.execPath, [require.resolve("nodemon/bin/nodemon.js"), "--config", "nodemon.json"], {
        cwd: root, stdio: "inherit", windowsHide: true
    });
    let stopping = false;
    const stop = async (code) => {
        if (stopping) return;
        stopping = true;
        if (server.exitCode === null && server.signalCode === null && server.pid) {
            if (process.platform === "win32") {
                // Stop only this child tree, including nodemon's API process.
                spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {windowsHide: true, stdio: "ignore"});
            } else server.kill("SIGTERM");
        }
        await dispose();
        process.exitCode = code;
    };
    server.once("error", (error) => { console.error(error); void stop(1); });
    server.once("exit", (code) => { void stop(code || 0); });
    process.once("SIGINT", () => { void stop(0); });
    process.once("SIGTERM", () => { void stop(0); });
}

main().catch((error) => {console.error(error); process.exitCode = 1;});
