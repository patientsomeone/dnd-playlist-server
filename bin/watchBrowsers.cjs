const esbuild = require("esbuild");
const {watchFile, unwatchFile} = require("node:fs");
const {join} = require("node:path");
const {root, copyClientHtml} = require("./buildTargets.cjs");

async function watchBrowsers() {
    const contexts = [];
    const template = join(root, "client", "index.html");
    const updateHtml = () => { copyClientHtml().catch((error) => console.error("Client HTML update failed", error)); };
    try {
        await copyClientHtml();
        for (const [name, options] of [
            ["legacy", require("./createListBuild.cjs")], ["client", require("./clientBuild.cjs")]
        ]) {
            const ready = Promise.withResolvers();
            let initial = true;
            const context = await esbuild.context({...options, plugins: [...options.plugins, {
                name: "watch-ready",
                setup(build) {
                    build.onEnd((result) => {
                        if (initial) {
                            initial = false;
                            if (result.errors.length) ready.reject(new Error(`Initial ${name} build failed`));
                            else ready.resolve();
                        }
                        if (!result.errors.length) console.log(`Built ${name} browser bundle`);
                    });
                }
            }]});
            contexts.push(context);
            await context.watch();
            await ready.promise;
        }
        watchFile(template, {interval: 250}, updateHtml);
        return async () => {
            unwatchFile(template, updateHtml);
            await Promise.all(contexts.map((context) => context.dispose()));
        };
    } catch (error) {
        await Promise.all(contexts.map((context) => context.dispose()));
        throw error;
    }
}

module.exports = {watchBrowsers};
