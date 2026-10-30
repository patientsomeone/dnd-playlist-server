import {defineConfig, devices} from "@playwright/test";
import {join} from "path";

process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(__dirname, "node_modules", ".cache", "playwright");

export default defineConfig({
    testDir: "./browser-tests",
    testMatch: "**/*.spec.ts",
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [["list"], ["html", {open: "never"}]],
    use: {
        baseURL: "http://127.0.0.1:4179",
        serviceWorkers: "block",
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}],
    webServer: {
        command: "node browser-tests/server.cjs",
        url: "http://127.0.0.1:4179/health",
        reuseExistingServer: false,
        timeout: 15000
    }
});
