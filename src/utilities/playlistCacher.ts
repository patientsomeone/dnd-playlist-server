import {resolve} from "path";
import {srcPath} from "./srcPath";
import {ChannelPlaylistCache, SqlitePlaylistStore, validateChannelId} from "./sqlitePlaylistCache";

let store: SqlitePlaylistStore | undefined;

export const getPlaylistCache = (channelId: string): ChannelPlaylistCache => {
    validateChannelId(channelId);
    store ||= new SqlitePlaylistStore(resolve(process.env.PLAYLIST_CACHE_DB_PATH || srcPath("data/playlist-cache.sqlite")));
    return new ChannelPlaylistCache(store, channelId, srcPath("public/json"));
};

export const closePlaylistCache = async (): Promise<void> => {
    const current = store;
    store = undefined;
    if (current) await current.close();
};
