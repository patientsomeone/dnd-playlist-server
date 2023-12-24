/* MODULES */
import {GoogleApis, youtube_v3} from "googleapis";

/* UTILITIES */
import {AsyncUtil} from "./asyncUtil";
import {LoadUrl} from "./urlLoader";
import {jsonUtils} from "./jsonUtils";
import {Properties} from "./fetchProperties";
import {dBug} from "./dBug";
import {Config} from "./fetchConfig";
import {playlistResponseData} from "../.types";


export const getPlaylistCounts = async (playlistData: playlistResponseData, jsonCache: jsonUtils) => {
    const debg = new dBug("utilities:getPlaylistCounts");
    
    const props = new Properties({
        "youtubeApiKey": ""
    });
    debg.call("Fetching Properties");
    const properties = await props.fetch() as {youtubeApiKey: string;};
    debg.call(properties.youtubeApiKey);
    
    const config = new Config({"playlists": {}})
    debg.call("Fetching Module Config");
    
    const listData = (await config.fetch() as {playlists: {[key: string]: string}}).playlists;
    debg.call(listData);
    
    const countData: {[listName: string]: {
        link: string;
        count: number;
    }} = {};
    
    const google = new GoogleApis({
        auth: properties.youtubeApiKey
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
    }

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
    }

    const fetchCount = async (id: string) => {
        const count = await getListDetails(id);
        return count;
    };

    await jsonCache.checkPath(true);

    const countedPlaylists = {};

    for await (const list of Object.keys(playlistData)) {
        const count = await fetchCount(playlistData[list].id);

        countedPlaylists[list] = playlistData[list];
        countedPlaylists[list].count = count;

        jsonCache.set(list, countedPlaylists[list]);
    };

    const currentDate = new Date();
    const oneDayPast = new Date(new Date().getTime() - (1 * 24 * 60 * 60 * 1000));

    // const lastUpdate = await jsonCache.get("lastUpdate");
    jsonCache.set("lastUpdate", Date.now());
    // debg.call(`Last Updated: ${lastUpdate}`);

    // const allPlaylists = jsonCache.read();

    // jsonCache = new jsonUtils("./json/listCount.json");
    // await jsonCache.checkPath(true);

    return countedPlaylists;
};
