export const PLAYLIST_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export const isPlaylistCacheFresh = (lastUpdate: unknown, now = Date.now(), inclusiveExpiry = false): boolean => {
    if (typeof lastUpdate !== "number" || !Number.isFinite(lastUpdate) || lastUpdate <= 0) {
        return false;
    }

    const expiresAt = lastUpdate + PLAYLIST_CACHE_TTL_MS;
    // Preserve the original browser reuse check (<=) and server/status checks (<).
    return inclusiveExpiry ? now <= expiresAt : now < expiresAt;
};
