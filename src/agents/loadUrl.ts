import { log, logLine } from "../utilities/log";

import { LoadUrl } from "../utilities/urlLoader";

const url = "https://media-dmg.assets-cdk.com/teams/repository/export/402/43ed095ba10058fed0050568ba825/40243ed095ba10058fed0050568ba825.js";


LoadUrl.single(url)
    .then((urlData) => {
        log(urlData);
    });

