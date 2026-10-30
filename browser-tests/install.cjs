const {spawnSync} = require("node:child_process");
const {join} = require("node:path");

const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "install", "chromium", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || join(__dirname, "..", "node_modules", ".cache", "playwright")
    }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
