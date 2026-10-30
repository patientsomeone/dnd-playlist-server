import {playlistQueries} from "../.types";
import {fetchEnv} from "./fetchEnv";
import {InvalidPlaylistQuery, validateChannelId} from "./sqlitePlaylistCache";

export const queryProcessor = async (query: Record<string, any>): Promise<playlistQueries> => {
    const explicitChannel = Object.prototype.hasOwnProperty.call(query, "channelId");
    const channelId = explicitChannel ? query.channelId : await fetchEnv("YT_LIST_OWNER");
    validateChannelId(channelId);
    let singlePlaylist = false;
    if (Object.prototype.hasOwnProperty.call(query, "singlePlaylist")) {
        const value = query.singlePlaylist;
        if (typeof value !== "string" || !/^(true|false)$/i.test(value)) {
            throw new InvalidPlaylistQuery("singlePlaylist must be true or false");
        }
        singlePlaylist = value.toLowerCase() === "true";
    }
    return {channelId, singlePlaylist};
};
