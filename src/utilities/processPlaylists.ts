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
import {log} from "./log";


export const getPlaylistCounts = async (playlistData: playlistResponseData, jsonCache: jsonUtils) => {
    const debg = new dBug("utilities:getPlaylistCounts");
    const envUrl = await fetchEnv("DO_ENV").catch((err) => {
        return Promise.resolve(false);
    });
    
    const youtubeApiKey = await fetchEnv("YT_API_KEY");
    
    const config = new Config({"playlists": {}});
    debg.call("Fetching Module Config");
    
    const countData: {[listName: string]: {
        link: string;
        count: number;
    };} = {};
    
    const google = new GoogleApis({
        auth: youtubeApiKey
    });

    const service = google.youtube("v3");

    const countVideos = async(videos: youtube_v3.Schema$PlaylistItem[]) => {
        let count = 0;

        for await (const video of videos) {
            if (video.contentDetails.hasOwnProperty("videoPublishedAt")) {
                count += 1;
            }
        }

        return count;
    };

    const getListDetails = async(listId: string, pageToken?: string) => {
        let videoCount = 0;

        const response = await service.playlistItems.list({
            part: ["contentDetails"],
            playlistId: listId,
            maxResults: 50,
            pageToken
        });
        const data = response.data;
        const videos = data.items;
        const nextPage = data.hasOwnProperty("nextPageToken") ? data.nextPageToken : false;
        const count = await countVideos(videos);

        if (!!nextPage) {
            const nextCount = await getListDetails(listId, nextPage);
            videoCount += nextCount;
        }

        videoCount += count;
        
        return videoCount;
    };

    const fetchCount = async (id: string) => {
        const count = await getListDetails(id);
        return count;
    };

    log("Processing Fetched Playlists");

    let siteJson = null;

    if (!envUrl) {
        siteJson = new jsonUtils("../../Apps/nginx-1.22.1/html/dndPlaylists/listCount.json");
        log(`Resetting Site Cache at: ${siteJson.viewPath() as string}`);
        await siteJson.checkPath(true);
    }
    
    log(`Resetting JSON Cache at: ${jsonCache.viewPath()}`);
    await jsonCache.checkPath(true);
    
    const countedPlaylists = {lastUpdate: 0};

    for await (const list of Object.keys(playlistData)) {
        // console.log(`Fetching Data for: ${list}`);
        const count = await fetchCount(playlistData[list].id);

        if (count > 0) {
            countedPlaylists[list] = playlistData[list];
            countedPlaylists[list].count = count;
    
            jsonCache.set(list, countedPlaylists[list]);

            if (!envUrl && !!siteJson) {
                siteJson.set(list, countedPlaylists[list]);
            }
        }
    }

    const currentDate = Date.now();
    
    jsonCache.set("lastUpdate", currentDate);

    if (!envUrl && !!siteJson) {
        siteJson.set("lastUpdate", currentDate);
    }
    countedPlaylists.lastUpdate = currentDate;

    log(`Successfully Processed ${Object.keys(countedPlaylists).length} playlists`);

    return countedPlaylists;
};
