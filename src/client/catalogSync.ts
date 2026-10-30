import {parsePlaylistCatalog, parsePlaylistCacheState, type PlaylistCatalog} from "../shared/playlistCatalog";
import type {CatalogStorage} from "./indexedCatalog";

export type CatalogPhase = "loading" | "checking" | "refreshing" | "ready" | "offline" | "error";
export type CatalogSyncOptions = {
    storage: CatalogStorage;
    channelId?: string;
    fetcher?: typeof fetch;
    onCatalog: (catalog: PlaylistCatalog | undefined) => void;
    onPhase: (phase: CatalogPhase) => void;
    notify?: (channelId: string) => void;
};

/** Catalog updates never call or own a YouTube player. */
export class CatalogSync {
    catalog?: PlaylistCatalog;
    readonly scope: string;
    private checking?: Promise<void>;
    private loading?: Promise<void>;
    private currentPhase: CatalogPhase = "loading";
    private refreshing?: Promise<void>;
    private pollTimer?: ReturnType<typeof setTimeout>;
    private polls = 0;
    private retryAfter = 0;
    private disposed = false;
    private channelId?: string;
    private requests = new Set<AbortController>();
    private fetcher: typeof fetch;

    constructor(private options: CatalogSyncOptions) {
        this.channelId = options.channelId;
        this.scope = options.channelId ? "channel:" + options.channelId : "default";
        this.fetcher = options.fetcher || globalThis.fetch.bind(globalThis);
    }

    private phase(phase: CatalogPhase): void {
        this.currentPhase = phase;
        if (!this.disposed) this.options.onPhase(phase);
    }

    async start(): Promise<void> {
        this.phase("loading");
        const loading = this.loadSaved();
        this.loading = loading;
        void this.check();
        await loading;
        if (this.loading === loading) this.loading = undefined;
    }

    private async loadSaved(): Promise<void> {
        const saved = await this.options.storage.load(this.scope).catch(() => undefined);
        if (this.disposed) return;
        if (saved && (!this.channelId || saved.channelId === this.channelId) &&
            (!this.catalog || saved.lastUpdate > this.catalog.lastUpdate)) {
            this.catalog = saved;
            this.options.onCatalog(saved);
            if (this.currentPhase === "error") this.phase("offline");
        }
    }

    private async waitForSaved(): Promise<void> {
        if (!this.loading) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            // Prefer the local snapshot without letting slow/blocked storage gate the network.
            await Promise.race([this.loading, new Promise<void>((resolve) => { timer = setTimeout(resolve, 100); })]);
        } finally { clearTimeout(timer); }
    }

    private endpoint(path: string, channelId = this.channelId): string {
        return channelId ? path + "?channelId=" + encodeURIComponent(channelId) : path;
    }

    private async json(path: string, timeout = 5000): Promise<any> {
        const controller = new AbortController();
        this.requests.add(controller);
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await this.fetcher(path, {cache: "no-store", signal: controller.signal});
            if (!response.ok) throw new Error("Playlist request failed");
            return await response.json();
        } finally {
            clearTimeout(timer);
            this.requests.delete(controller);
        }
    }

    private adopt(catalog: PlaylistCatalog): void {
        if (this.disposed || catalog.channelId !== this.channelId) return;
        if (this.catalog?.channelId === catalog.channelId && this.catalog.lastUpdate >= catalog.lastUpdate) return;
        this.catalog = catalog;
        this.options.onCatalog(catalog);
        // Playback/selection need not wait for disk persistence.
        this.options.storage.save(this.scope, catalog).then((saved) => {
            if (this.disposed || saved.channelId !== this.channelId) return;
            if (saved.lastUpdate > (this.catalog?.lastUpdate ?? -1)) {
                this.catalog = saved;
                this.options.onCatalog(saved);
            }
            this.options.notify?.(saved.channelId);
        }).catch(() => undefined); // In-memory use remains available when storage is blocked/full.
    }

    private fail(): void {
        this.retryAfter = Date.now() + 30000;
        this.phase(this.catalog ? "offline" : "error");
    }

    private poll(): void {
        if (this.disposed || this.pollTimer !== undefined) return;
        if (this.polls >= 40) return this.fail();
        this.pollTimer = setTimeout(() => {
            this.pollTimer = undefined;
            this.polls += 1;
            void this.check();
        }, 3000);
    }

    private refresh(channelId: string): void {
        if (this.refreshing !== undefined) return this.poll();
        if (Date.now() < this.retryAfter) return;
        this.phase("refreshing");
        this.refreshing = this.json(this.endpoint("/refreshPlaylists", channelId), 30000).then((data) => {
            if (this.disposed || this.channelId !== channelId) return;
            if (data?.status === "processing") return this.poll();
            const catalog = parsePlaylistCatalog(data, channelId);
            if (!catalog) throw new Error("No refreshed catalog");
            this.adopt(catalog);
            this.polls = 0;
            this.phase("ready");
        }).catch(() => {
            if (!this.disposed) { this.fail(); this.poll(); }
        }).finally(() => { this.refreshing = undefined; });
    }

    private async checkServer(): Promise<void> {
        this.phase(this.refreshing !== undefined ? "refreshing" : "checking");
        const stateEndpoint = this.options.channelId ? this.endpoint("/cacheState", this.options.channelId) : "/cacheState";
        const state = parsePlaylistCacheState(await this.json(stateEndpoint));
        if (this.disposed) return;
        if (this.options.channelId && state.channelId !== this.options.channelId) throw new Error("Unexpected playlist channel");
        this.channelId = state.channelId;
        await this.waitForSaved();
        if (this.disposed) return;
        if (this.catalog && this.catalog.channelId !== state.channelId) {
            this.catalog = undefined;
            this.options.onCatalog(undefined);
        }
        if (state.hasCache && state.lastUpdate !== null && (!this.catalog || state.lastUpdate > this.catalog.lastUpdate)) {
            const catalog = parsePlaylistCatalog(await this.json(this.endpoint("/listCount")), state.channelId);
            if (!catalog || catalog.lastUpdate < state.lastUpdate) throw new Error("Catalog does not match its server state");
            this.adopt(catalog);
        }
        if (state.locked) {
            this.phase("refreshing");
            this.poll();
        } else if (!state.fresh) {
            if (Date.now() < this.retryAfter) this.phase(this.catalog ? "offline" : "error");
            else this.refresh(state.channelId);
        } else {
            this.polls = 0;
            if (this.pollTimer !== undefined) clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
            this.phase(this.catalog ? "ready" : "error");
        }
    }

    check(): Promise<void> {
        if (this.disposed) return Promise.resolve();
        if (this.checking !== undefined) return this.checking;
        this.checking = this.checkServer().catch(() => this.fail()).finally(() => { this.checking = undefined; });
        return this.checking;
    }

    async beforeSelection(): Promise<void> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([this.check(), new Promise<void>((resolve) => { timer = setTimeout(resolve, 1500); })]);
        } finally {
            clearTimeout(timer);
        }
    }

    retry(): Promise<void> {
        this.polls = 0;
        this.retryAfter = 0;
        return this.check();
    }

    find(id: string): {name: string; id: string; count: number;} | undefined {
        const entry = Object.entries(this.catalog?.playlists || {}).find(([, playlist]) => playlist.id === id);
        return entry && {name: entry[0], id: entry[1].id, count: entry[1].count};
    }

    dispose(): void {
        this.disposed = true;
        if (this.pollTimer !== undefined) clearTimeout(this.pollTimer);
        for (const request of this.requests) request.abort();
        this.options.storage.close();
    }
}
