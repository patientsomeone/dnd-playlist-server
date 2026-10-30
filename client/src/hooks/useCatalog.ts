import {useCallback, useEffect, useRef, useState} from "react";
import {CatalogSync, type CatalogPhase} from "../../../src/client/catalogSync";
import {IndexedCatalogStorage} from "../../../src/client/indexedCatalog";
import type {PlaylistCatalog} from "../../../src/shared/playlistCatalog";

export function useCatalog(channelId?: string) {
    const [catalog, setCatalog] = useState<PlaylistCatalog>();
    const [phase, setPhase] = useState<CatalogPhase>("loading");
    const current = useRef<CatalogSync | undefined>(undefined);

    useEffect(() => {
        setCatalog(undefined);
        setPhase("loading");
        let broadcast: BroadcastChannel | undefined;
        try {
            if (typeof BroadcastChannel !== "undefined") broadcast = new BroadcastChannel("dnd-playlist-catalog");
        } catch { /* Cross-tab notification is optional. */ }
        const sync = new CatalogSync({
            channelId, storage: new IndexedCatalogStorage(), onCatalog: setCatalog, onPhase: setPhase,
            notify: (channel) => broadcast?.postMessage({channelId: channel})
        });
        current.current = sync;
        const check = () => { void sync.check(); };
        const retry = () => { void sync.retry(); };
        const visible = () => { if (!document.hidden) check(); };
        const message = (event: MessageEvent<{channelId?: string;}>) => {
            if (sync.catalog && event.data?.channelId === sync.catalog.channelId) check();
        };
        const hide = (event: PageTransitionEvent) => { if (!event.persisted) sync.dispose(); };
        broadcast?.addEventListener("message", message);
        window.addEventListener("focus", check);
        window.addEventListener("online", retry);
        window.addEventListener("pageshow", check);
        window.addEventListener("pagehide", hide);
        document.addEventListener("visibilitychange", visible);
        void sync.start();
        return () => {
            window.removeEventListener("focus", check);
            window.removeEventListener("online", retry);
            window.removeEventListener("pageshow", check);
            window.removeEventListener("pagehide", hide);
            document.removeEventListener("visibilitychange", visible);
            broadcast?.removeEventListener("message", message);
            broadcast?.close();
            sync.dispose();
            if (current.current === sync) current.current = undefined;
        };
    }, [channelId]);

    const check = useCallback(() => { void current.current?.check(); }, []);
    const retry = useCallback(() => { void current.current?.retry(); }, []);
    const resolveSelection = useCallback(async (id: string) => {
        const sync = current.current;
        if (!sync) return;
        await sync.beforeSelection();
        if (current.current !== sync) return;
        return sync.find(id);
    }, []);
    return {catalog, phase, check, retry, resolveSelection};
}
