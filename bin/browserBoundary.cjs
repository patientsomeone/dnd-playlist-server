const {relative, resolve} = require("node:path");
const root = resolve(__dirname, "..");

module.exports = {
    name: "browser-boundary",
    setup(build) {
        build.onResolve({filter: /^(node:|express$|dotenv$|sqlite3$|@googleapis\/)/}, ({path}) => ({
            errors: [{text: `Server dependency is unavailable in browser builds: ${path}`}]
        }));
        build.onLoad({filter: /.*/, namespace: "file"}, ({path}) => {
            const source = relative(root, path).replaceAll("\\", "/");
            const dependency = path.replaceAll("\\", "/").includes("/node_modules/");
            const browserSource = source === "src/agents/createList.ts" || source.startsWith("client/") ||
                source.startsWith("src/client/") || source.startsWith("src/shared/");
            if (!dependency && !browserSource) {
                return {errors: [{text: `Server source is unavailable in browser builds: ${source}`} ]};
            }
        });
    }
};
