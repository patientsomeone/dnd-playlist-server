import {youtube} from "@googleapis/youtube";
import type {anyObject, playlistQueries} from "../.types";
import {getPlaylistCache} from "./playlistCacher";
import {getPlaylistCounts} from "./getPlaylistCounts";
import {fetchEnv} from "./fetchEnv";
import {processPlaylists} from "./processPlaylists";
import type {playlistData} from "./processPlaylists";
import {dipsProcessor} from "../agents/dipsListProcessor";
import {isPlaylistCacheFresh} from "../shared/playlistCachePolicy";
import {REFRESH_LEASE_MS} from "./sqlitePlaylistCache";

export const fetchChannelPlaylists = async (query: playlistQueries): Promise<anyObject> => {
    const cache = getPlaylistCache(query.channelId);
    if (await cache.isRefreshing()) return {status: "processing"};
    const cached = await cache.read();
    if (isPlaylistCacheFresh(cached.lastUpdate)) return cached;

    const token = await cache.acquire();
    if (!token) return {status: "processing"};
    let leaseLost = false;
    const heartbeat = setInterval(() => {
        cache.renew(token).then((renewed) => {
            if (!renewed) leaseLost = true;
        }).catch(() => { leaseLost = true; });
    }, REFRESH_LEASE_MS / 3);
    heartbeat.unref();

    try {
        // A different request may have completed between our first read and acquisition.
        const latest = await cache.read();
        if (isPlaylistCacheFresh(latest.lastUpdate)) return latest;
        const service = youtube({version: "v3", auth: await fetchEnv("YT_API_KEY")});
        const lists: playlistData[] = [];
        const seenTokens = new Set<string>();
        let pageToken: string | undefined;
        do {
            const response = await service.playlists.list({
                part: ["id", "snippet", "status"],
                maxResults: 50,
                channelId: query.channelId,
                ...(pageToken ? {pageToken} : {})
            }, {timeout: 30000});
            for (const item of response.data.items || []) {
                if (typeof item.id !== "string" || typeof item.snippet?.title !== "string") {
                    throw new Error("Incomplete YouTube playlist response");
                }
                lists.push({id: item.id, snippet: {title: item.snippet.title}});
            }
            pageToken = response.data.nextPageToken || undefined;
            if (pageToken && seenTokens.has(pageToken)) throw new Error("Repeated YouTube playlist page token");
            if (pageToken) seenTokens.add(pageToken);
        } while (pageToken);
        const processed = await processPlaylists(lists, dipsProcessor);
        const counted = await getPlaylistCounts(processed);
        if (leaseLost) throw new Error("Playlist refresh lease was lost");
        await cache.replace(counted, token);
        return counted;
    } finally {
        clearInterval(heartbeat);
        await cache.release(token);
    }
};
