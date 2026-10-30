/* Import UTILITIES */
import { dBug } from "../utilities/dBug";

/* Import MODULES */
import { resolve } from "path";
import {projectRoot} from "./projectRoot";

export const srcPath = (additionalPath: string|void): string => {
    const deb = new dBug("utilties:srcPath").call();

    const currentPath = resolve(projectRoot, additionalPath || "");

    deb(`Base Path: ${projectRoot}`);
    deb(`Current Path: ${currentPath}`);

    return currentPath;
};
