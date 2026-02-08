/* eslint-disable camelcase */
/* MODULES */
import {GoogleApis, youtube_v3} from "googleapis";

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
    const processedLinks = {};
    let checkedLists = 0;

    for await (const playlist of allPlaylists) {
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
    log(`Identified ${Object.keys(processedLinks).length} playlists`);

    return processedLinks;
};