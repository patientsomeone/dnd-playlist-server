const {join} = require("node:path");

process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(__dirname, "..", "node_modules", ".cache", "playwright");

module.exports = {
    testDir: __dirname,
    testMatch: "built-client.spec.cjs",
    outputDir: join(__dirname, "..", "test-results", "built-client"),
    timeout: 60_000,
    globalTimeout: 120_000,
    expect: {timeout: 10_000},
    workers: 1,
    retries: 0,
    forbidOnly: !!process.env.CI,
    reporter: "list",
    use: {
        browserName: "chromium",
        headless: true,
        serviceWorkers: "block",
        actionTimeout: 10_000,
        navigationTimeout: 15_000,
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    }
};
