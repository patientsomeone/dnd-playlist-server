import {fetchChannelPlaylists} from "../utilities/fetchPlaylists";
import {executeArguments} from "../utilities/argProcessor";
import {FsUtils} from "../utilities/fsUtils";
import {dateStamp} from "../utilities/dateStamp";
import {anyObject} from "../.types";
import {fetchEnv} from "../utilities/fetchEnv";
import {log} from "../utilities/log";

export const fetchLists = async (): Promise<anyObject> => {
    const playlistOwner = await fetchEnv("YT_LIST_OWNER");
    const listData = await fetchChannelPlaylists(playlistOwner);

    return listData;
};

const initialize = async () => {
    log("Fetching Playlists");

    try {
        log("Fetching Playlists");
        return fetchLists()
            .catch((err) => {
                console.error(err);
            });
    } catch (error) {
        throw(error);
    }

};

(async () => {
    try {
        await initialize();

        // await executeArguments({
        //     start: initialize
        // });
    } catch (error) {
        throw(error);
    }
})();

