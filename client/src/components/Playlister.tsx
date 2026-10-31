import {useLayoutEffect, useMemo, useRef} from "react";
import type {playlistProcessed} from "../../../src/shared/playlistTypes";
import {playbackLabels, type PlaybackView} from "../player/PlaylistPlayer";
import {uniquePlaylistEntries} from "../../../src/shared/uniquePlaylists";
import {IconButton} from "./IconButton";

type Props = {
    playlists: playlistProcessed; playback: PlaybackView; onSelect: (id: string) => void;
    query: string; page: number; onPageChange: (page: number) => void;
    secondaryPlayback?: PlaybackView;
    mode?: "single" | "added" | "swapped";
    favorites?: ReadonlySet<string>;
    onAdd?: (id: string) => void;
    onRemove?: (id: string) => void;
    onSwap?: (id: string) => void;
    onFavorite?: (id: string) => void;
};
const NO_FAVORITES: ReadonlySet<string> = new Set();
const PAGE_SIZE = 100;
const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const PLAYBACK_ACTIONS: Record<PlaybackView["state"], string> = {
    idle: "Activate to play this playlist.", loading: "Please wait for the player to become ready.",
    playing: "Activate to pause playback.", paused: "Activate to resume playback.",
    buffering: "Activate to toggle playback.", error: "Activate to retry this playlist."
};

function initialLetter(name: string): string {
    const initial = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
    return /^[A-Z]$/.test(initial) ? initial : "#";
}

function revealPlaylist(list: HTMLDListElement | null, id: string): void {
    const target = Array.from(list?.querySelectorAll<HTMLAnchorElement>("a[data-playlist-id]") || []).find((link) => link.dataset.playlistId === id);
    target?.focus({preventScroll: true});
    target?.scrollIntoView({block: "start"});
}

export default function PlayLister({playlists, playback, secondaryPlayback, mode = "single", favorites = NO_FAVORITES, onSelect, onAdd, onRemove, onSwap, onFavorite, query, page, onPageChange}: Props) {
    // Enforce identity here too, even if a caller supplies an unnormalized catalog.
    const entries = useMemo(() => uniquePlaylistEntries(Object.entries(playlists)).sort(([left, a], [right, b]) =>
        Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || (left < right ? -1 : left > right ? 1 : 0)), [playlists, favorites]);
    const matching = useMemo(() => entries.filter(([name]) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [entries, query]);
    const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const list = useRef<HTMLDListElement>(null);
    const pendingJump = useRef<string | undefined>(undefined);
    const pendingFavorite = useRef<string | undefined>(undefined);
    const starts = useMemo(() => {
        const letters = new Map<string, number>();
        matching.forEach(([name], index) => {
            const letter = initialLetter(name);
            const existing = letters.get(letter);
            if (existing === undefined || (favorites.has(matching[existing][1].id) && !favorites.has(matching[index][1].id))) letters.set(letter, index);
        });
        return letters;
    }, [matching, favorites]);

    useLayoutEffect(() => {
        const id = pendingFavorite.current;
        if (!id) return;
        pendingFavorite.current = undefined;
        const button = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button[data-favorite-id]") || []).find((element) => element.dataset.favoriteId === id);
        if (button) button.focus({preventScroll: true});
        else list.current?.querySelector<HTMLAnchorElement>("a[data-playlist-id]")?.focus({preventScroll: true});
    }, [entries, current]);

    useLayoutEffect(() => {
        const id = pendingJump.current;
        pendingJump.current = undefined;
        if (id) revealPlaylist(list.current, id);
    }, [current, matching]);

    const jump = (letter: string) => {
        const index = starts.get(letter);
        if (index === undefined) return;
        const id = matching[index][1].id;
        const destination = Math.floor(index / PAGE_SIZE);
        if (destination === current) revealPlaylist(list.current, id);
        else { pendingJump.current = id; onPageChange(destination); }
    };
    return (
        <>
            {query && matching.length === 0 && <p>No matching playlists.</p>}
            <dl id="listParent" ref={list}>
                {matching.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map(([name, playlist]) => {
                    const primary = playlist.id === playback.id;
                    const secondary = playlist.id === secondaryPlayback?.id;
                    const view = primary ? playback : secondary ? secondaryPlayback : undefined;
                    const active = !!view;
                    const switchPlayback = active && mode === "swapped" && !!secondaryPlayback?.id;
                    const action = switchPlayback ? "Activate to switch playback between the loaded playlists." : view ? PLAYBACK_ACTIONS[view.state] : "Activate to play this playlist.";
                    const descriptionId = "playlist-description-" + encodeURIComponent(playlist.id);
                    return (
                        <dt key={playlist.id} className="playlist-row">
                            <a href={"https://www.youtube.com/playlist?list=" + encodeURIComponent(playlist.id)}
                                data-playlist-id={playlist.id} data-playback-state={view?.state} data-player-role={primary ? "main" : secondary ? "secondary" : undefined}
                                className={view ? "active " + view.state + (secondary ? " secondary-active" : "") : undefined}
                                aria-current={primary ? "true" : undefined}
                                aria-describedby={descriptionId}
                                aria-label={name}
                                onClick={(event) => { event.preventDefault(); onSelect(playlist.id); }}>
                                <span>{name}</span>
                                {view && <span className="playback-badge">{secondary ? "Secondary · " : ""}{playbackLabels[view.state]}</span>}
                            </a>
                            <div className="playlist-actions" role="group" aria-label={"Actions for " + name}>
                                <IconButton icon={active ? "remove" : "add"} label={active ? "Remove " + name + " from the player" : "Add " + name + " to the secondary player"}
                                    indicator={!active && secondaryPlayback?.id ? "swap" : undefined}
                                    title={!active && secondaryPlayback?.id ? "Replace the secondary player with " + name : undefined}
                                    disabled={active ? !onRemove : !onAdd} aria-pressed={active}
                                    onClick={() => active ? onRemove?.(playlist.id) : onAdd?.(playlist.id)}/>
                                <IconButton icon="swap" label={"Swap to " + name} disabled={!onSwap || primary} onClick={() => onSwap?.(playlist.id)}/>
                                <IconButton icon="favorite" className="favorite-toggle" label={(favorites.has(playlist.id) ? "Unfavorite " : "Favorite ") + name}
                                    aria-pressed={favorites.has(playlist.id)} data-favorite-id={playlist.id} disabled={!onFavorite}
                                    onClick={() => { pendingFavorite.current = playlist.id; onFavorite?.(playlist.id); }}/>
                            </div>
                            <span id={descriptionId} className="visually-hidden">
                                {view ? (secondary ? "Secondary player. " : "") + playbackLabels[view.state] + ". " + action : action}
                            </span>
                        </dt>
                    );
                })}
            </dl>
            {entries.length > 0 && <nav className="alphabet-rail" aria-label="Playlist alphabet">
                {LETTERS.map((letter) => <button type="button" key={letter} disabled={!starts.has(letter)}
                    aria-label={letter === "#" ? "Jump to numbers and symbols" : "Jump to " + letter}
                    title={(starts.has(letter) ? "Jump to " : "No playlists starting with ") + (letter === "#" ? "numbers and symbols" : letter)} onClick={() => jump(letter)}>{letter}</button>)}
            </nav>}
            {pages > 1 && <nav aria-label="Playlist pages">
                <button disabled={current === 0} title="Previous playlist page" onClick={() => onPageChange(current - 1)}>Previous</button>
                <span role="status">Page {current + 1} of {pages} ({matching.length} playlists)</span>
                <button disabled={current + 1 === pages} title="Next playlist page" onClick={() => onPageChange(current + 1)}>Next</button>
            </nav>}
        </>
    );
}
