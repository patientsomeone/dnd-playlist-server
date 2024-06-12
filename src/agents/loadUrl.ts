import { log, logLine } from "../utilities/log";

import { LoadUrl } from "../utilities/urlLoader";

const url = "http://patientsomeone.ddnsfree.com/dndPlaylists/playlists.json";

(async () => {
    await LoadUrl.single(url)
        .then((urlData) => {
            log(urlData);
        });
})();

