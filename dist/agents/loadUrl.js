"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("../utilities/log");
const urlLoader_1 = require("../utilities/urlLoader");
const url = "http://patientsomeone.ddnsfree.com/dndPlaylists/playlists.json";
urlLoader_1.LoadUrl.single(url)
    .then((urlData) => {
    (0, log_1.log)(urlData);
});
// Additional Line
//# sourceMappingURL=loadUrl.js.map