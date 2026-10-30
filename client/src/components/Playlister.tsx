import {useLayoutEffect, useMemo, useRef} from "react";
import type {playlistProcessed} from "../../../src/shared/playlistTypes";
import {playbackLabels, type PlaybackView} from "../player/PlaylistPlayer";
import {uniquePlaylistEntries} from "../../../src/shared/uniquePlaylists";

type Props = {
    playlists: playlistProcessed; playback: PlaybackView; onSelect: (id: string) => void;
    query: string; page: number; onPageChange: (page: number) => void;
};
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

export default function PlayLister({playlists, playback, onSelect, query, page, onPageChange}: Props) {
    // Enforce identity here too, even if a caller supplies an unnormalized catalog.
    const entries = useMemo(() => uniquePlaylistEntries(Object.entries(playlists)).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0), [playlists]);
    const matching = useMemo(() => entries.filter(([name]) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [entries, query]);
    const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const list = useRef<HTMLDListElement>(null);
    const pendingJump = useRef<string | undefined>(undefined);
    const starts = useMemo(() => {
        const letters = new Map<string, number>();
        matching.forEach(([name], index) => {
            const letter = initialLetter(name);
            if (!letters.has(letter)) letters.set(letter, index);
        });
        return letters;
    }, [matching]);

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
                    const active = playlist.id === playback.id;
                    const descriptionId = "playlist-description-" + encodeURIComponent(playlist.id);
                    return (
                        <dt key={playlist.id}>
                            <a href={"https://www.youtube.com/playlist?list=" + encodeURIComponent(playlist.id)}
                                data-playlist-id={playlist.id} data-playback-state={active ? playback.state : undefined}
                                className={active ? "active " + playback.state : undefined}
                                aria-current={active ? "true" : undefined}
                                aria-describedby={descriptionId}
                                aria-label={name}
                                onClick={(event) => { event.preventDefault(); onSelect(playlist.id); }}>
                                <span>{name}</span>
                                {active && <span className="playback-badge">{playbackLabels[playback.state]}</span>}
                            </a>
                            <span id={descriptionId} className="visually-hidden">
                                {active ? playbackLabels[playback.state] + ". " + PLAYBACK_ACTIONS[playback.state] : "Activate to play this playlist."}
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
