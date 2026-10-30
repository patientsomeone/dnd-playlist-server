import {existsSync} from "node:fs";
import {dirname, join} from "node:path";

function findProjectRoot(): string {
    let directory = __dirname;
    while (!existsSync(join(directory, "package.json"))) {
        const parent = dirname(directory);
        if (parent === directory) throw new Error("Unable to locate application package.json");
        directory = parent;
    }
    return directory;
}

// Works from src/utilities and dist/server/utilities without relying on cwd.
export const projectRoot = findProjectRoot();
