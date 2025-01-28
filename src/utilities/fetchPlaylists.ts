/* MODULES */
import {GoogleApis} from "googleapis";

/* UTILITIES */
import {AsyncUtil} from "./asyncUtil";
import {LoadUrl} from "./urlLoader";
import {jsonUtils} from "./jsonUtils";
import {dBug} from "./dBug";
import {Config} from "./fetchConfig";
import {getPlaylistCounts} from "./getPlaylistCounts";
import {err, log, logLine} from "./log";
import {FsUtils} from "./fsUtils";
import {dateStamp} from "./dateStamp";
import {anyObject, playlistQueries, stringObject} from "../.types";
import {fetchEnv} from "./fetchEnv";
import {toTitleCase} from "./textManipulators";
import {processPlaylists} from "./processPlaylists";
import {dipsProcessor} from "../agents/dipsListProcessor";
import {currentTime} from "./timeConversion";


// TODO: Convert LockID to Query passthrough
export const fetchChannelPlaylists = async (query: playlistQueries): Promise<anyObject> => {
    const debg = new dBug("utilities:fetchChannelPlaylists");

    // TODO: Lock file with timestamp
    log(`Locking with ID: ${query.channelId} marked at ${currentTime()}`);

    const apiLock = new FsUtils(`./public/locks/${query.channelId}.lock`);
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
            // TODO: Pass variables through query parameters
            log(`Setting Cache name: ${query.channelId}`);
            const jsonCache = new jsonUtils(`./public/json/${query.channelId}.json`);
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
                // return {status: "processing"};
            }

            let listItems = null;
            let processed = null;
            let countedList = null;

            try {
                listItems = await fetchPlaylistData(query.channelId);
            } catch (error) {
                err(`Unable to list items | Error: ${error.toString()}`);
                return Promise.reject(error);
            }

            try {
                processed = await processPlaylists(listItems, dipsProcessor);
            } catch (error) {
                err(`Unable to process playlists | Error: ${error.toString()}`);
                return Promise.reject(error);
            }

            try {
                countedList = await getPlaylistCounts(processed, jsonCache);
            } catch (error) {
                err(`Unable to list items | Error: ${error.toString()}`);
                return Promise.reject(error);
            }

            
            

            log("Fetched Playlist count data");

            await apiLock.delete();
            log("Deleted Playlist lock");

            log("Playlist Update Complete");

            return countedList;
        } catch (error) {
            log(`Unable to fetch ${error as string}`);
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
    await fetchChannelPlaylists({
        channelId: await fetchEnv("YT_LIST_OWNER")
    });
};

test()
    .catch((err) => {
        console.error(err);
    });