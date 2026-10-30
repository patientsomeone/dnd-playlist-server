const {join} = require("node:path");
const root = join(__dirname, "..");

// Shared by production, watch mode, and the isolated browser-test server.
module.exports = {
    absWorkingDir: root,
    entryPoints: [join(root, "src", "agents", "createList.ts")],
    outfile: join(root, "public", "createList.js"),
    bundle: true,
    sourcemap: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    tsconfig: join(root, "tsconfig.legacy.json"),
    metafile: true,
    plugins: [require("./browserBoundary.cjs")]
};
