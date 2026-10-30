require("./require-runtime.cjs");
const {buildTarget} = require("./buildTargets.cjs");

async function main() {
    const target = process.argv[2] || "all";
    for (const name of target === "all" ? ["server", "legacy", "client"] : [target]) {
        console.log(`Building ${name}`);
        await buildTarget(name);
    }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
