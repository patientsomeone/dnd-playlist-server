import {useCallback, useState} from "react";
import {useCatalog} from "./hooks/useCatalog";
import PlayLister from "./components/Playlister";
import {YouTubePlayer} from "./components/YouTubePlayer";
import {PlaylistSearch} from "./components/PlaylistSearch";
import {IconButton} from "./components/IconButton";
import {playbackLabels} from "./player/PlaylistPlayer";
import {usePlaylistDeck} from "./hooks/usePlaylistDeck";
import {useFavorites} from "./hooks/useFavorites";
import {isPlaylistCacheFresh} from "../../src/shared/playlistCachePolicy";

declare global {
    interface Window {gtag?: (...args: any[]) => void;}
}

export function ReactLists() {
    const channelId = new URL(window.location.href).searchParams.get("channelId") || undefined;
    const {catalog, phase, check, retry, resolveSelection} = useCatalog(channelId);
    const scope = channelId ? "channel:" + channelId : "default";
    const deck = usePlaylistDeck(check, resolveSelection);
    const {favorites, toggle: toggleFavorite} = useFavorites(scope);
    const [search, setSearch] = useState({query: "", page: 0});
    const updateSearch = useCallback((query: string) => setSearch({query, page: 0}), []);
    const primary = deck.view.primary;
    const secondary = primary === 0 ? 1 : 0;
    const playback = deck.view.playback[primary];
    const hasSecondary = !!deck.view.selections[secondary];
    const controls = (slot: 0 | 1) => {
        if (!deck.view.selections[slot]) return null;
        const view = deck.view.playback[slot];
        const paused = view.state === "paused" || view.state === "idle" || view.state === "error";
        const name = view.name || "playlist";
        return <div className="player-controls">
            <IconButton icon={paused ? "play" : "pause"} label={(view.state === "error" ? "Retry " : paused ? "Resume " : "Pause ") + name}
                className={"playback-toggle " + view.state + (slot !== primary ? " secondary-active" : "")}
                disabled={!deck.view.selections[slot]} onClick={() => deck.togglePlayer(slot)}/>
            {slot === primary ? hasSecondary && <IconButton icon="swap" label="Swap players" onClick={deck.swapPlayers}/> :
                <IconButton icon="swap" label={"Make " + name + " the main player"} onClick={deck.swapPlayers}/>}
        </div>;
    };
    const messages = {
        loading: "Loading playlists...",
        checking: "Checking for playlist updates...",
        refreshing: catalog ? "Updating playlists in the background..." : "Loading playlists from the server...",
        ready: "",
        offline: "Using saved playlists; updates are unavailable.",
        error: "Unable to load playlists. Please retry."
    };
    const status = deck.view.message || messages[phase];
    return (
        <main className="playlist-app">
            <div className="organizer">
                <section id="frameParent" aria-label="Video players">
                    <div className={"player-deck" + (hasSecondary ? " has-secondary" : "")}>
                        <div className="player-toolbar">
                            <h2 className={playback.state} aria-live="polite">{playbackLabels[playback.state]}{playback.name ? ": " + playback.name : ""}</h2>
                            {controls(primary)}
                            <PlaylistSearch query={search.query} scope={scope} onSearch={updateSearch}/>
                        </div>
                        <div className="player-slots">
                            {([0, 1] as const).map((slot) => (slot === 0 || deck.view.selections[slot]) && <YouTubePlayer key={scope + ":" + slot}
                                ref={deck.refs[slot]} slot={slot} selection={deck.view.selections[slot]} view={deck.view.playback[slot]}
                                onPlaybackChange={deck.updates[slot]} secondary={slot !== primary} hidden={slot !== primary && !deck.view.selections[slot]}
                                style={{order: slot === primary ? 0 : 1}} headingAction={controls(slot)}
                                onInteraction={check} resolveSelection={resolveSelection}/>)}
                        </div>
                    </div>
                </section>
                <section aria-label="Playlists">
                    <h1 className="app-title">{document.title}</h1>
                    {catalog && Object.keys(catalog.playlists).length === 0 && <p>No playlists found for this channel.</p>}
                    <PlayLister playlists={catalog?.playlists || {}} playback={playback} secondaryPlayback={hasSecondary ? deck.view.playback[secondary] : undefined} mode={deck.view.mode}
                        favorites={favorites} onSelect={deck.select} onAdd={deck.add} onRemove={deck.remove} onSwap={deck.swap}
                        onFavorite={(id) => { toggleFavorite(id); setSearch((current) => ({...current, page: 0})); }}
                        query={search.query} page={search.page} onPageChange={(page) => setSearch((current) => ({...current, page}))}/>
                    <p id="catalogStatus" hidden={!status} role={phase === "error" && !catalog ? "alert" : "status"} aria-live="polite">{status}</p>
                    {(phase === "error" || phase === "offline") && <button title="Retry loading playlists" onClick={() => { deck.clearMessage(); retry(); }}>Retry</button>}
                    <sub id="lastUpdated" className={catalog && isPlaylistCacheFresh(catalog.lastUpdate) ? "fresh" : "expired"}>
                        {catalog && "Last Updated: " + new Date(catalog.lastUpdate).toLocaleString()}
                        <br/>Author: Joshua Robinson
                    </sub>
                </section>
            </div>
        </main>
    );
}
