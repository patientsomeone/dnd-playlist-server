/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverageDirectory: "coverage",
    collectCoverageFrom: [
        "src/agents/dipsListProcessor.ts",
        "src/agents/refreshList.ts",
        "src/shared/**/*.ts",
        "src/routes/app.ts",
        "src/routes/reactClient.ts",
        "src/client/catalogSync.ts",
        "src/utilities/{processPlaylists,queryProcessor,fetchPlaylists,getPlaylistCounts,playlistCacher,sqlitePlaylistCache,jsonUtils,fetchConfig,urlLoader}.ts"
    ],
    coverageReporters: ["text", "html", "lcov", "json-summary"],
    coverageThreshold: {
        global: {statements: 80, branches: 80, functions: 65, lines: 80}
    },
    cacheDirectory: "<rootDir>/node_modules/.cache/jest",
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {tsconfig: "<rootDir>/tsconfig.test.json"}]
    }
};
