import {fetchChannelPlaylists} from "../utilities/fetchPlaylists";
import {executeArguments} from "../utilities/argProcessor";
import {FsUtils} from "../utilities/fsUtils";
import {dateStamp} from "../utilities/dateStamp";
import {anyObject} from "../.types";

export const fetchLists = async (): Promise<anyObject> => {
    const listData = await fetchChannelPlaylists("UCr7k176h5b1JwD9yXpSUkGA");

    return listData;
};

const initialize = async () => {
    const logFile = new FsUtils(`./logs/${dateStamp()}_playlistLogs.txt`);
    const logger = logFile.logFile;

    try {
        await logger("Fetching Playlists");
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

