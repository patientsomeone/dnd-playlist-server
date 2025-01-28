import {fetchChannelPlaylists} from "../utilities/fetchPlaylists";
import {anyObject, playlistQueries} from "../.types";
import {fetchEnv} from "../utilities/fetchEnv";
import {log} from "../utilities/log";
import {queryProcessor} from "../utilities/queryProcessor";

export const fetchLists = async (query: playlistQueries): Promise<anyObject> => {
    let listData = null;

    // const query = await queryProcessor(queryObject);

    log("Fetching Playlists");
    log(query);
    // TODO: Differentiate a list of Playlists from a list of Videos

    if (!query.singlePlaylist) {
        log("Loading all Playlists");
        listData = await fetchChannelPlaylists(query);
    } else {
        // TODO: Set assign Single Playlist Endpoint
        log("Loading Single Playlist");
        listData = await fetchChannelPlaylists(query);
    }

    return listData;
};
