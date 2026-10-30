import {isPlaylistCacheFresh} from "../src/shared/playlistCachePolicy";

describe("original 12-hour playlist cache policy", () => {
    const now = 1800000000000;

    test.each([
        [0, true, true],
        [6 * 60 * 60 * 1000, true, true],
        [12 * 60 * 60 * 1000 - 1, true, true],
        [12 * 60 * 60 * 1000, false, true],
        [12 * 60 * 60 * 1000 + 1, false, false],
        [36 * 60 * 60 * 1000, false, false]
    ])("preserves the server and browser checks at age %i ms", (age, serverFresh, browserCanReuse) => {
        expect(isPlaylistCacheFresh(now - Number(age), now)).toBe(serverFresh);
        expect(isPlaylistCacheFresh(now - Number(age), now, true)).toBe(browserCanReuse);
    });

    test.each([undefined, null, false, 0, -1, "1800000000000", NaN, Infinity])(
        "rejects a missing or invalid update timestamp: %s",
        (lastUpdate) => {
            expect(isPlaylistCacheFresh(lastUpdate, now)).toBe(false);
        }
    );
});
