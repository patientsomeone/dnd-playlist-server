/** Old incremental caches can retain several names for one YouTube playlist. */
export function uniquePlaylistEntries<T extends {id: string;}>(entries: [string, T][]): [string, T][] {
    const byId = new Map<string, [string, T]>();
    for (const entry of entries) {
        const previous = byId.get(entry[1].id);
        // No per-row rename timestamp exists: use the first alphabetical label consistently.
        if (!previous || entry[0] < previous[0]) byId.set(entry[1].id, entry);
    }
    return [...byId.values()];
}
