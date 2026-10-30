const {join} = require("node:path");
const root = join(__dirname, "..");

module.exports = {
    absWorkingDir: root,
    entryPoints: [join(root, "client", "src", "main.tsx")],
    outdir: join(root, "dist", "client", "assets"),
    tsconfig: join(root, "tsconfig.client.json"),
    bundle: true,
    sourcemap: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    jsx: "automatic",
    metafile: true,
    plugins: [require("./browserBoundary.cjs")]
};
