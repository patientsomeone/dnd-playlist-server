/* MODULES */
import {GoogleApis, youtube_v3} from "googleapis";

/* UTILITIES */
import {AsyncUtil} from "../utilities/asyncUtil";
import {LoadUrl} from "../utilities/urlLoader";
import {jsonUtils} from "../utilities/jsonUtils";
import {Properties} from "../utilities/fetchProperties";
import {dBug} from "../utilities/dBug";
import {Config} from "../utilities/fetchConfig";


(async () => {
    try {
        const debg = new dBug("utilities:getListCounts");
        
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

        const fetchCount = async (link: string) => {
            const listId = (await new URLSearchParams(link.split("?")[1])).get("list");
            const count = await getListDetails(listId);



            const listCount = {
                id: listId,
                count
            };
            return listCount;
        };

        const jsonCache = new jsonUtils("./json/listCount.json")

        await jsonCache.checkPath(true);

        for await (const list of Object.keys(listData)) {
            const data = await fetchCount(listData[list]);
            const updatedObj = {
                link: listData[list],
                count: data.count,
                id: data.id
            } 

            countData[list] = updatedObj;

            jsonCache.set(list.split(".").join("\\."), updatedObj);
            // return listCount;
        };

    } catch (error) {
        console.error(error);
    }
})();
