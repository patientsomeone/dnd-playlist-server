import {fetchChannelPlaylists} from "../utilities/fetchPlaylists";
import {executeArguments} from "../utilities/argProcessor";
import {FsUtils} from "../utilities/fsUtils";
import {dateStamp} from "../utilities/dateStamp";

export const fetchLists = async () => {
    const listData = await fetchChannelPlaylists("UCr7k176h5b1JwD9yXpSUkGA");

    return listData;
}

const initialize = () => {
    const logFile = new FsUtils(`./logs/${dateStamp()}_playlistLogs.txt`);
    const logger = logFile.logFile;

    logger(`Fetching Playlists`);
    return fetchLists()
        .catch((err) => {
            console.error(err);
        })
}

initialize();

executeArguments({
    start: initialize
});