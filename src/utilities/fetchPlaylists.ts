/* MODULES */
import {GoogleApis} from "googleapis";

/* UTILITIES */
import {AsyncUtil} from "./asyncUtil";
import {LoadUrl} from "./urlLoader";
import {jsonUtils} from "./jsonUtils";
import {dBug} from "./dBug";
import {Config} from "./fetchConfig";
import {getPlaylistCounts} from "./processPlaylists";
import {log, logLine} from "./log";
import {FsUtils} from "./fsUtils";
import {dateStamp} from "./dateStamp";
import {anyObject} from "../.types";
import {fetchEnv} from "./fetchEnv";
import {toTitleCase} from "./textManipulators";
import {processPlaylists} from "./processVideos";

export const fetchChannelPlaylists = async (channelId: string, ownerId: string): Promise<anyObject> => {
    const debg = new dBug("utilities:fetchChannelPlaylists");

    const apiLock = new FsUtils(`./public/locks/${ownerId}.lock`);
    const isLocked = await apiLock.check()
        .catch((err) => {
            return Promise.resolve(false);
        });
    
    const youtubeApiKey = await fetchEnv("YT_API_KEY");
    const google = new GoogleApis({
        auth: youtubeApiKey
    });
    
    const service = google.youtube("v3");
    
    const fetchPlaylistData = async (channelId: string, pageToken?: string) => {
        try {
            let workingLists = [];

            const listConfig = {
                part: ["id", "snippet", "status"],
                maxResults: 50,
                channelId
            } as {
                part: string[];
                maxResults: number;
                channelId: string;
                pageToken?: string;
            };

            if (!!pageToken) (
                listConfig.pageToken = pageToken
            );

            const allLists = await service.playlists.list(listConfig);
            /* console.log("Playlists fetched"); */

            if (allLists.data.hasOwnProperty("nextPageToken")) {
                workingLists = workingLists.concat(await fetchPlaylistData(channelId, allLists.data.nextPageToken));
            }
    
            workingLists = workingLists.concat(allLists.data.items);

            return workingLists;
        } catch (error) {
            console.error(`Unable to fetch Playlists ${error as string}`);
        }
    };
    
    const initialize = async () => {
        const deb = debg.set("initialize");
        log("Checking playlist files...");
        try {
            const jsonCache = new jsonUtils("./public/json/listCount.json");
            await jsonCache.checkPath();
            const lastUpdate = jsonCache.get("lastUpdate") as number || false;
            
            if (!!lastUpdate && Date.now() < (lastUpdate + (12 * 60 * 60 * 1000))) {
                log("API Data up to date");
                deb("JSON Cache Recently Updated");
                return jsonCache.read();
            }

            if (!isLocked) {
                log("Locking API execution");
                await apiLock.create.raw("");
            }

            const listItems = await fetchPlaylistData(channelId);
            const processed = await processPlaylists(listItems);
            const countedList = await getPlaylistCounts(processed, jsonCache);

            log("Fetched Playlist count data");

            await apiLock.delete();
            log("Deleted Playlist lock");

            log("Playlist Update Complete");

            return countedList;
        } catch (error) {
            deb(`Unable to fetch ${error as string}`);
        }
    };

    if (!!isLocked) {
        log("On Load Status Check: API Processing");
        return {status: "processing"};
    }

    try {
        return await initialize();
    } catch (err) {
        log(`Unable to fetch Playlists ${err as string}`, true);
    }
};

const test = async () => {
    await fetchChannelPlaylists(await fetchEnv("YT_PLAYLIST_OWNER"), "dipsLists");
};

// test()
//     .catch((err) => {
//         console.error(err);
//     });