require("./require-runtime.cjs");
const {watchBrowsers} = require("./watchBrowsers.cjs");

async function main() {
    const dispose = await watchBrowsers();
    const stop = () => { void dispose(); };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
}
main().catch((error) => {console.error(error); process.exitCode = 1;});
