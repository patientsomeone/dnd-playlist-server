import {useCallback, useEffect, useRef, useState} from "react";
import {useCatalog} from "./hooks/useCatalog";
import PlayLister from "./components/Playlister";
import {YouTubePlayer, type PlaybackControls} from "./components/YouTubePlayer";
import {PlaylistSearch} from "./components/PlaylistSearch";
import type {PlaylistSelection, PlaybackView} from "./player/PlaylistPlayer";
import {isPlaylistCacheFresh} from "../../src/shared/playlistCachePolicy";

declare global {
    interface Window {gtag?: (...args: any[]) => void;}
}

export function ReactLists() {
    const channelId = new URL(window.location.href).searchParams.get("channelId") || undefined;
    const {catalog, phase, check, retry, resolveSelection} = useCatalog(channelId);
    const [selection, setSelection] = useState<PlaylistSelection>();
    const [playback, setPlayback] = useState<PlaybackView>({state: "idle"});
    const [message, setMessage] = useState<string>();
    const [search, setSearch] = useState({query: "", page: 0});
    const updateSearch = useCallback((query: string) => setSearch({query, page: 0}), []);
    const request = useRef(0);
    const player = useRef<PlaybackControls>(null);
    useEffect(() => () => { request.current += 1; }, []);

    const select = async (id: string) => {
        const latestRequest = ++request.current;
        if (player.current?.toggle(id)) {
            setMessage(undefined);
            check();
            return;
        }
        setMessage("Loading latest playlists...");
        try {
            const latest = await resolveSelection(id);
            if (latestRequest !== request.current) return;
            if (!latest) {
                setMessage("That playlist is no longer available. Please choose another.");
                return;
            }
            try { window.gtag?.("event", "click", {event_category: "button", event_label: latest.name}); } catch { /* Analytics is optional. */ }
            setSelection({...latest, request: latestRequest});
            setMessage(undefined);
        } catch {
            if (latestRequest === request.current) setMessage("Unable to select that playlist. Please try again.");
        }
    };
    const messages = {
        loading: "Loading playlists...",
        checking: "Checking for playlist updates...",
        refreshing: catalog ? "Updating playlists in the background..." : "Loading playlists from the server...",
        ready: "",
        offline: "Using saved playlists; updates are unavailable.",
        error: "Unable to load playlists. Please retry."
    };
    const status = message || messages[phase];
    return (
        <main className="playlist-app">
            <div className="organizer">
                <YouTubePlayer ref={player} key={channelId || "default"} selection={selection} view={playback} onPlaybackChange={setPlayback}
                    headingAction={<PlaylistSearch query={search.query} scope={channelId ? "channel:" + channelId : "default"} onSearch={updateSearch}/>}
                    onInteraction={check} resolveSelection={resolveSelection}/>
                <section aria-label="Playlists">
                    <h1 className="app-title">{document.title}</h1>
                    {catalog && Object.keys(catalog.playlists).length === 0 && <p>No playlists found for this channel.</p>}
                    <PlayLister playlists={catalog?.playlists || {}} playback={playback} onSelect={(id) => { void select(id); }}
                        query={search.query} page={search.page} onPageChange={(page) => setSearch((current) => ({...current, page}))}/>
                    <p id="catalogStatus" hidden={!status} role={phase === "error" && !catalog ? "alert" : "status"} aria-live="polite">{status}</p>
                    {(phase === "error" || phase === "offline") && <button title="Retry loading playlists" onClick={() => { setMessage(undefined); retry(); }}>Retry</button>}
                    <sub id="lastUpdated" className={catalog && isPlaylistCacheFresh(catalog.lastUpdate) ? "fresh" : "expired"}>
                        {catalog && "Last Updated: " + new Date(catalog.lastUpdate).toLocaleString()}
                        <br/>Author: Joshua Robinson
                    </sub>
                </section>
            </div>
        </main>
    );
}
