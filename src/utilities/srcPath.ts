/* Import UTILITIES */
import { dBug } from "../utilities/dBug";

/* Import MODULES */
import { normalize } from "path";

export const srcPath = (additionalPath: string|void): string => {
    const deb = new dBug("utilties:srcPath").call();

    const currentPath = normalize(`${__dirname}../../../${!additionalPath ? "" : additionalPath}`);

    deb(`Base Path: ${normalize(`${__dirname}../../../`)}`);
    deb(`Current Path: ${currentPath}`);

    return currentPath;
};
