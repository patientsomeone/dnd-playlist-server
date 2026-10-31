import {useCallback, useEffect, useRef, useState} from "react";
import {emptyDeck, PlaylistDeck, type PlayerControls, type PlayerSlot} from "../player/PlaylistDeck";
import type {PlaylistSelection, PlaybackView} from "../player/PlaylistPlayer";

export function usePlaylistDeck(check: () => void, resolveSelection: (id: string) => Promise<Omit<PlaylistSelection, "request"> | undefined>) {
    const first = useRef<PlayerControls>(null);
    const second = useRef<PlayerControls>(null);
    const deck = useRef<PlaylistDeck | undefined>(undefined);
    const [view, setView] = useState(emptyDeck);
    useEffect(() => {
        const controller = new PlaylistDeck({controls: (slot) => slot === 0 ? first.current : second.current,
            resolveSelection, onInteraction: check, onView: setView});
        deck.current = controller;
        return () => { controller.dispose(); if (deck.current === controller) deck.current = undefined; };
    }, [check, resolveSelection]);
    const onFirst = useCallback((playback: PlaybackView) => deck.current?.updatePlayer(0, playback), []);
    const onSecond = useCallback((playback: PlaybackView) => deck.current?.updatePlayer(1, playback), []);
    const select = useCallback((id: string) => { void deck.current?.select(id); }, []);
    const add = useCallback((id: string) => { void deck.current?.add(id); }, []);
    const swap = useCallback((id: string) => { void deck.current?.swap(id); }, []);
    const remove = useCallback((id: string) => deck.current?.remove(id), []);
    const swapPlayers = useCallback(() => deck.current?.swapPlayers(), []);
    const togglePlayer = useCallback((slot: PlayerSlot) => { void deck.current?.togglePlayer(slot); }, []);
    const clearMessage = useCallback(() => deck.current?.clearMessage(), []);
    return {view, refs: [first, second] as const, updates: [onFirst, onSecond] as const, select, add, swap, remove, swapPlayers, togglePlayer, clearMessage};
}
