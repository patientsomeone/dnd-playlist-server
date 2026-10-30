const [major, minor, patch] = process.versions.node.split(".").map(Number);
if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
    console.error(`Use Node 24.22.1 or a newer 24.x release (currently ${process.version}). See .nvmrc and README.md.`);
    process.exit(1);
}
