// Compile-only contracts: regression to any makes the expected-error checks fail.
// This module is never executed and does not load the IFrame script or call Google.
import type {youtube_v3 as YoutubeV3} from "@googleapis/youtube";
import type {} from "../src/agents/createList";

export function playerContract(player: YT.Player, event: YT.OnStateChangeEvent, browser: Window): void {
    const options = {
        playerVars: {autoplay: 1, loop: 1, enablejsapi: 1},
        events: {onStateChange: (change: YT.OnStateChangeEvent) => change.target.setLoop(true)}
    } satisfies YT.PlayerOptions;
    player.loadPlaylist({list: "PL_fixture", listType: "playlist", index: 0});
    event.target.setShuffle(true);
    browser.player?.loadPlaylist({list: "PL_fixture"});
    void options;

    // @ts-expect-error A playlist must have its actual string ID.
    player.loadPlaylist({list: 123});
    // @ts-expect-error The Window player must retain the SDK signature, not any.
    browser.player?.loadPlaylist({list: 123});
    // @ts-expect-error Player state events contain a numeric PlayerState.
    const state: string = event.data;
    void state;
}

export function dataContract(response: YoutubeV3.Schema$PlaylistListResponse): string[] {
    // @ts-expect-error YouTube may omit the item collection.
    response.items.map((item) => item.id);
    return (response.items || []).flatMap((playlist) => {
        // @ts-expect-error IDs may be null or omitted before normalization.
        const unvalidated: string = playlist.id;
        void unvalidated;
        return typeof playlist.id === "string" ? [playlist.id] : [];
    });
}
