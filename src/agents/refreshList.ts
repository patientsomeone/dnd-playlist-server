import {fetchChannelPlaylists} from "../utilities/fetchPlaylists";
import {anyObject} from "../.types";
import {fetchEnv} from "../utilities/fetchEnv";
import {log} from "../utilities/log";

export const fetchLists = async (queryObject: {[key: string]: string;}): Promise<anyObject> => {
    const query = await (async () => {
        const workingQuery = {
            listOwner: "",
            ownerId: ""
        };

        const defaultQuery = {
            listOwner: async () => {
                return await fetchEnv("YT_LIST_OWNER");
            },
            ownerId: async () => {
                return await defaultQuery.listOwner();
            },
            singlePlaylist: async () => {
                return Promise.resolve("false");
            }
        };
        
        for await (const key of Object.keys(defaultQuery)) {
            if (queryObject.hasOwnProperty(key)) {
                workingQuery[key] = queryObject[key];
            } else {
                workingQuery[key] = await defaultQuery[key]();
            }
        }
        
        return workingQuery;
    })();

    let listData = null;

    if (queryObject.singlePlaylist.toLowerCase() === "false") {
        log("Loading all Playlists");
        listData = await fetchChannelPlaylists(query.listOwner, query.ownerId);
    } else {
        // TODO: Set assign Single Playlist Endpoint
        log("Loading Single Playlist");
        listData = await fetchChannelPlaylists(query.listOwner, query.ownerId);
    }

    return listData;
};
