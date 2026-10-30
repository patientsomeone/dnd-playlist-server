
/* MODULES */

/* UTILITIES */
import {AsyncUtil} from "./asyncUtil";
import {LoadUrl} from "./urlLoader";
import {jsonUtils} from "./jsonUtils";
import {dBug} from "./dBug";
import {Config} from "./fetchConfig";
import {anyObject, playlistResponseData} from "../.types";
import {FsUtils} from "./fsUtils";
import {dateStamp} from "./dateStamp";
import {fetchEnv} from "./fetchEnv";
import {err, log} from "./log";
import {toTitleCase} from "./textManipulators";
import {uniquePlaylistEntries} from "../shared/uniquePlaylists";

export type playlistData = {
    snippet: {title: string;};
    id: string;
};

export type processedLinks = {
    name: string;
    data: linkData;
};

export type linkData = {
    link: string;
    id: string;
};

type allLinks = {
    [key: string]: linkData;
};

type playlistArray = playlistData[];

export const processPlaylists = async (allPlaylists: playlistArray, playlistProcessor: (playlist: playlistData) => Promise<processedLinks | false>): Promise<allLinks> => {
    const processedLinks: allLinks = {};
    let checkedLists = 0;

    for (const playlist of allPlaylists) {
        checkedLists += 1;
        let processed = null;
        try {
            processed = await playlistProcessor(playlist);
            if (!processed) {
                continue;
            }
        } catch (error) {
            err(error);
            throw(error);
        }

        processedLinks[processed.name] = processed.data;
    }

    log(`Checked ${checkedLists} playlists`);
    const uniqueLinks = Object.fromEntries(uniquePlaylistEntries(Object.entries(processedLinks)));
    log(`Identified ${Object.keys(uniqueLinks).length} playlists`);

    return uniqueLinks;
};
