import {useEffect, useRef, useState} from "react";
import {SearchPreferenceStorage, type SearchPreferences} from "../storage/searchPreferences";

type Props = {query: string; scope: string; onSearch: (query: string) => void;};

export function PlaylistSearch({query, scope, onSearch}: Props) {
    const [preferences, setPreferences] = useState<SearchPreferences>({open: false, query});
    const {open, query: draft} = preferences;
    const [floating, setFloating] = useState(false);
    const [composing, setComposing] = useState(false);
    const anchor = useRef<HTMLSpanElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const storage = useRef<SearchPreferenceStorage | undefined>(undefined);
    const edited = useRef(false);

    useEffect(() => {
        const store = new SearchPreferenceStorage();
        storage.current = store;
        let disposed = false;
        store.load(scope).then((saved) => {
            if (disposed || edited.current || !saved) return;
            setPreferences(saved);
            onSearch(saved.query);
        }).catch(() => undefined);
        return () => {
            disposed = true;
            if (storage.current === store) storage.current = undefined;
            store.close();
        };
    }, [scope, onSearch]);

    const update = (next: SearchPreferences) => {
        edited.current = true;
        setPreferences(next);
        void storage.current?.save(scope, next).catch(() => undefined);
    };

    useEffect(() => {
        if (draft === query || composing) return;
        const timer = setTimeout(() => onSearch(draft), 300);
        return () => clearTimeout(timer);
    }, [draft, query, composing, onSearch]);

    useEffect(() => {
        if (!anchor.current) return;
        const observer = new IntersectionObserver(([entry]) => setFloating(!entry.isIntersecting));
        observer.observe(anchor.current);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <span ref={anchor} className="search-anchor">
                <button ref={trigger} type="button" className={"icon-button search-trigger" + (floating ? " floating" : "")}
                    aria-label="Search playlists" aria-expanded={open} aria-controls="playlistSearch"
                    data-filtered={!!query.trim()} title={(open ? "Collapse search" : "Expand search") + (query.trim() ? ": " + query : "")}
                    onClick={() => update({...preferences, open: !open})}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
                        <circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>
                    </svg>
                </button>
            </span>
            {open && <form id="playlistSearch" className="search-panel" aria-label="Search playlists"
                onSubmit={(event) => { event.preventDefault(); if (!composing) onSearch(draft); }}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && !composing) { event.preventDefault(); update({...preferences, open: false}); trigger.current?.focus(); }
                }}>
                <label className="visually-hidden" htmlFor="playlistSearchInput">Search playlists</label>
                <input id="playlistSearchInput" ref={input} type="search" placeholder="Search playlists" autoComplete="off" autoFocus value={draft}
                    onChange={(event) => update({...preferences, query: event.target.value})} onCompositionStart={() => setComposing(true)}
                    onCompositionEnd={(event) => { update({...preferences, query: event.currentTarget.value}); setComposing(false); }}/>
                <button type="button" className="icon-button clear-search" disabled={!draft} aria-label="Clear search" title="Clear search"
                    onClick={() => { update({...preferences, query: ""}); input.current?.focus(); }}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>
                    </svg>
                </button>
            </form>}
        </>
    );
}
