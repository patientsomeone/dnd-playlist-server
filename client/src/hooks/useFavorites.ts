import {useCallback, useEffect, useRef, useState} from "react";
import {FavoriteStorage} from "../storage/favoritePreferences";

type Session = {scope: string; storage: FavoriteStorage; ids: Set<string>; touched: Map<string, boolean>;};
const EMPTY: ReadonlySet<string> = new Set();

export function useFavorites(scope: string) {
    const [saved, setSaved] = useState<{scope: string; ids: ReadonlySet<string>;}>({scope, ids: EMPTY});
    const current = useRef<Session | undefined>(undefined);
    useEffect(() => {
        const session: Session = {scope, storage: new FavoriteStorage(), ids: new Set(), touched: new Map()};
        current.current = session;
        void session.storage.load(scope).then((ids) => {
            if (current.current !== session) return;
            const merged = new Set(ids);
            for (const [id, favorite] of session.touched) { if (favorite) merged.add(id); else merged.delete(id); }
            session.ids = merged;
            setSaved({scope, ids: merged.size ? merged : EMPTY});
        }).catch(() => undefined);
        return () => { if (current.current === session) current.current = undefined; session.storage.close(); };
    }, [scope]);
    const toggle = useCallback((id: string) => {
        const session = current.current;
        if (!session || session.scope !== scope) return;
        const ids = new Set(session.ids);
        const favorite = !ids.has(id);
        if (favorite) ids.add(id); else ids.delete(id);
        session.ids = ids;
        session.touched.set(id, favorite);
        setSaved({scope, ids});
        void session.storage.save(scope, id, favorite).catch(() => undefined);
    }, [scope]);
    return {favorites: saved.scope === scope ? saved.ids : EMPTY, toggle};
}
