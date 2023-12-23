"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.srcPath = void 0;
/* Import UTILITIES */
const dBug_1 = require("../utilities/dBug");
/* Import MODULES */
const path_1 = require("path");
const srcPath = (additionalPath) => {
    const deb = new dBug_1.dBug("utilties:srcPath").call();
    const currentPath = (0, path_1.normalize)(`${__dirname}../../../${additionalPath}`);
    deb(`Base Path: ${(0, path_1.normalize)(`${__dirname}../../../`)}`);
    deb(`Current Path: ${currentPath}`);
    return currentPath;
};
exports.srcPath = srcPath;
//# sourceMappingURL=srcPath.js.map