import type {individualPlaylist} from "./playlistTypes";
import {uniquePlaylistEntries} from "./uniquePlaylists";

export type PlaylistCatalog = {
    channelId: string;
    lastUpdate: number;
    playlists: Record<string, individualPlaylist>;
};

export type PlaylistCacheState = {
    channelId: string;
    lastUpdate: number | null;
    hasCache: boolean;
    locked: boolean;
    fresh: boolean;
    serverTime: number;
};

export function parsePlaylistCatalog(data: any, channelId: string): PlaylistCatalog | undefined {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid playlist catalog");
    if (data.lastUpdate === undefined && Object.keys(data).length === 0) return undefined;
    if (!Number.isSafeInteger(data.lastUpdate) || data.lastUpdate < 0) throw new Error("Invalid playlist timestamp");
    const entries = Object.entries(data).filter(([name]) => name !== "lastUpdate").map<[string, individualPlaylist]>(([name, value]) => {
        const playlist: any = value;
        if (!playlist || typeof playlist.id !== "string" || !playlist.id || typeof playlist.link !== "string" ||
            !Number.isSafeInteger(playlist.count) || playlist.count < 0) throw new Error("Invalid playlist entry");
        return [name, {id: playlist.id, link: playlist.link, count: playlist.count}];
    });
    return {channelId, lastUpdate: data.lastUpdate, playlists: Object.fromEntries(uniquePlaylistEntries(entries))};
}

export function parsePlaylistCacheState(data: any): PlaylistCacheState {
    if (!data || typeof data.channelId !== "string" || !/^[A-Za-z0-9_-]+$/.test(data.channelId) ||
        !(data.lastUpdate === null || Number.isSafeInteger(data.lastUpdate) && data.lastUpdate >= 0) ||
        typeof data.hasCache !== "boolean" || typeof data.locked !== "boolean" || typeof data.fresh !== "boolean" ||
        !Number.isFinite(data.serverTime) || data.hasCache !== (data.lastUpdate !== null) || data.fresh && !data.hasCache) {
        throw new Error("Invalid playlist cache state");
    }
    return data;
}
