import {youtube} from "@googleapis/youtube";
import type {playlistResponseData} from "../.types";
import {fetchEnv} from "./fetchEnv";
import type {PlaylistSnapshot} from "./sqlitePlaylistCache";

// Counting builds a complete snapshot in memory. It never clears or writes the cache.
export const getPlaylistCounts = async (playlistData: playlistResponseData): Promise<PlaylistSnapshot> => {
    const service = youtube({version: "v3", auth: await fetchEnv("YT_API_KEY")});
    const counted: PlaylistSnapshot = {lastUpdate: 0};
    for (const [name, playlist] of Object.entries(playlistData)) {
        let count = 0;
        let pageToken: string | undefined;
        const seenTokens = new Set<string>();
        do {
            const response = await service.playlistItems.list({
                part: ["contentDetails"], playlistId: playlist.id, maxResults: 50, pageToken
            }, {timeout: 30000});
            for (const item of response.data.items || []) {
                if (item.contentDetails && Object.prototype.hasOwnProperty.call(item.contentDetails, "videoPublishedAt")) count += 1;
            }
            pageToken = response.data.nextPageToken || undefined;
            if (pageToken && seenTokens.has(pageToken)) throw new Error("Repeated YouTube playlist item page token");
            if (pageToken) seenTokens.add(pageToken);
        } while (pageToken);
        if (count > 0) counted[name] = {...playlist, count};
    }
    counted.lastUpdate = Date.now();
    return counted;
};
