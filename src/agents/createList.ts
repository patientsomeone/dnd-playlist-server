import {isPlaylistCacheFresh} from "../shared/playlistCachePolicy";
import type {PlaylistCatalog} from "../shared/playlistCatalog";
import {IndexedCatalogStorage} from "../client/indexedCatalog";
import {CatalogSync, type CatalogPhase} from "../client/catalogSync";
import {uniquePlaylistEntries} from "../shared/uniquePlaylists";

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        onPlayerReady?: (event: YT.PlayerEvent) => void;
        player?: YT.Player;
        YT?: typeof YT;
        gtag?: (...args: any[]) => void;
        frameUpdated?: boolean;
        noShuffle?: boolean;
    }
}

const parent = document.querySelector("#listParent");
const heading = document.createElement("h1");
heading.textContent = "Dip's Organized Playlists";
const status = document.createElement("p");
status.id = "catalogStatus";
status.hidden = true;
status.setAttribute("aria-live", "polite");
const retry = document.createElement("button");
retry.textContent = "Retry";
retry.hidden = true;
const list = document.createElement("dl");
const updated = document.createElement("sub");
updated.id = "lastUpdated";
parent?.append(heading, status, retry, list, updated);

let phase: CatalogPhase = "loading";
let selectionMessage: string | undefined;
let playerReady = false;
let queued: {id: string; request: number;} | undefined;
let selectionRequest = 0;
window.noShuffle = false;

const channelId = new URL(location.href).searchParams.get("channelId") || undefined;
let broadcasts: BroadcastChannel | undefined;
try {
    if (typeof BroadcastChannel !== "undefined") broadcasts = new BroadcastChannel("dnd-playlist-catalog");
} catch {
    // Cross-tab notifications are optional; server checks still work.
}

const sync = new CatalogSync({
    storage: new IndexedCatalogStorage(),
    channelId,
    onCatalog: renderCatalog,
    onPhase: (next) => { phase = next; renderStatus(); },
    notify: (channel) => broadcasts?.postMessage({channelId: channel})
});

function renderStatus(): void {
    const messages: Record<CatalogPhase, string> = {
        loading: "Loading playlists...",
        checking: "Checking for playlist updates...",
        refreshing: sync.catalog ? "Updating playlists in the background..." : "Loading playlists from the server...",
        ready: "",
        offline: "Using saved playlists; updates are unavailable.",
        error: "Unable to load playlists. Please retry."
    };
    status.textContent = selectionMessage || (sync.catalog ? "" : messages[phase]);
    status.hidden = !status.textContent;
    status.setAttribute("role", phase === "error" && !sync.catalog ? "alert" : "status");
    retry.hidden = !!sync.catalog || phase !== "error" && phase !== "offline";
}

function renderCatalog(catalog: PlaylistCatalog | undefined): void {
    const focused = document.activeElement;
    const focusedId = focused instanceof HTMLAnchorElement && list.contains(focused) ? focused.dataset.playlistId : undefined;
    const fragment = document.createDocumentFragment();
    const playlists = catalog?.playlists || {};
    const entries = uniquePlaylistEntries(Object.entries(playlists)).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    for (const [name, playlist] of entries) {
        const element = document.createElement("dt");
        const anchor = document.createElement("a");
        anchor.textContent = name;
        anchor.href = "https://www.youtube.com/playlist?list=" + encodeURIComponent(playlist.id);
        anchor.id = playlist.id;
        anchor.dataset.playlistId = playlist.id;
        anchor.setAttribute("count", String(playlist.count));
        anchor.addEventListener("click", (event) => {
            event.preventDefault();
            try {
                window.gtag?.("event", "click", {event_category: "button", event_label: name});
            } catch {
                // Analytics must not prevent selection.
            }
            const request = ++selectionRequest;
            selectionMessage = undefined;
            renderStatus();
            selectPlaylist(playlist.id, request).catch(() => {
                if (request === selectionRequest) {
                    selectionMessage = "Unable to select that playlist. Please try again.";
                    renderStatus();
                }
            });
        });
        element.append(anchor);
        fragment.append(element);
    }
    list.replaceChildren(fragment);
    if (focusedId) {
        Array.from(list.querySelectorAll("a")).find((anchor) => anchor.dataset.playlistId === focusedId)?.focus({preventScroll: true});
    }
    updated.className = catalog && isPlaylistCacheFresh(catalog.lastUpdate) ? "fresh" : "expired";
    updated.replaceChildren(document.createTextNode(catalog
        ? "Last Updated: " + new Date(catalog.lastUpdate).toLocaleString()
        : "No saved playlists yet."), document.createElement("br"), document.createTextNode("Author: Joshua Robinson"));
    renderStatus();
}

function setHeaderState(state: string): void {
    const header = document.querySelector("#frameParent h2");
    if (!header) return;
    const parts = header.textContent.split(":");
    const name = parts.length > 1 ? parts.slice(1).join(":").trim() : header.textContent;
    header.textContent = state.slice(0, 1).toUpperCase() + state.slice(1) + ": " + name;
    header.classList.remove("paused", "playing", "buffering");
    header.classList.add(state);
}

function playerStateChange(event: YT.OnStateChangeEvent): void {
    void sync.check();
    const states = window.YT?.PlayerState;
    if (!states) return;
    if (event.data === states.PLAYING) {
        if (window.frameUpdated) {
            window.frameUpdated = false;
            if (!window.noShuffle) {
                try { window.player?.setShuffle(true); } catch { /* Optional player call; keep playback usable. */ }
            }
            try { window.player?.setLoop(true); } catch { /* Optional player call; keep playback usable. */ }
        }
        return setHeaderState("playing");
    }
    setHeaderState(event.data === states.PAUSED ? "paused" : "buffering");
}

window.onPlayerReady = () => { void sync.check(); };
window.onYouTubeIframeAPIReady = () => {
    const api = window.YT;
    if (window.player || !api) return;
    window.player = new api.Player("shufflerFrame", {
        playerVars: {autoplay: 1, loop: 1, enablejsapi: 1},
        events: {
            onReady: () => {
                playerReady = true;
                if (queued) {
                    const selection = queued;
                    selectPlaylist(selection.id, selection.request).catch(() => {
                        if (selection.request === selectionRequest) {
                            selectionMessage = "Unable to select that playlist. Please try again.";
                            renderStatus();
                        }
                    });
                }
            },
            onStateChange: playerStateChange,
            onPlaybackRateChange: () => { void sync.check(); },
            onError: () => {
                void sync.check();
                try { window.player?.nextVideo(); } catch { /* Skipping is best effort if the player is unavailable. */ }
            }
        }
    });
};

function injectApi(): void {
    if (document.querySelector("#youTubeApi")) return;
    const script = document.createElement("script");
    script.id = "youTubeApi";
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
        script.remove();
        selectionMessage = "The video player could not load. Select a playlist to retry.";
        renderStatus();
    };
    document.head.append(script);
}

async function selectPlaylist(id: string, request: number): Promise<void> {
    await sync.beforeSelection();
    if (request !== selectionRequest) return;
    const config = sync.find(id);
    if (!config) {
        queued = undefined;
        selectionMessage = "That playlist is no longer available. Please choose another.";
        renderStatus();
        return;
    }
    if (!playerReady) {
        queued = {id, request};
        injectApi();
        return;
    }
    queued = undefined;
    selectionMessage = undefined;
    renderStatus();
    updateFrame(config);
}

// Only an explicit playlist selection calls this. Catalog refreshes never do.
function updateFrame(config: {id: string; count: number; name: string;}): void {
    const player = window.player;
    if (!player) return;
    window.frameUpdated = true;
    const title = document.querySelector("#frameParent h2");
    try { player.stopVideo(); } catch { /* A stopped/unavailable player may reject this call. */ }
    if (title) title.textContent = "Buffering: " + config.name;
    window.noShuffle = config.name.toLowerCase().includes("boss");
    try {
        player.loadPlaylist({
            listType: "playlist", suggestedQuality: "hd720", list: config.id,
            index: window.noShuffle ? 0 : Math.floor(Math.random() * config.count)
        });
    } catch {
        console.warn("Unable to load the selected playlist into the player");
    }
}

retry.addEventListener("click", () => { selectionMessage = undefined; void sync.retry(); });
broadcasts?.addEventListener("message", (event) => {
    if (event.data?.channelId === sync.catalog?.channelId) void sync.check();
});
window.addEventListener("online", () => { void sync.retry(); });
window.addEventListener("focus", () => { void sync.check(); });
window.addEventListener("pageshow", (event) => { if (event.persisted) void sync.check(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) void sync.check(); });
for (const event of ["pointerdown", "keydown"]) {
    document.querySelector("#frameParent")?.addEventListener(event, () => { void sync.check(); });
}
window.addEventListener("pagehide", (event) => {
    if (!event.persisted) { sync.dispose(); broadcasts?.close(); }
});
sync.start().catch(() => { phase = "error"; renderStatus(); });
