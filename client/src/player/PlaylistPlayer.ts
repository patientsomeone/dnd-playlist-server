import {loadYouTubeApi} from "./youtubeApi";

export type PlaylistSelection = {id: string; name: string; count: number; request: number;};
export type PlaybackView = {
    state: "idle" | "loading" | "buffering" | "playing" | "paused" | "error";
    name?: string;
    message?: string;
    id?: string;
};
export const playbackLabels: Record<PlaybackView["state"], string> = {
    idle: "Ready to Play", loading: "Loading player", buffering: "Buffering", playing: "Playing", paused: "Paused", error: "Player unavailable"
};
type PlayerOptions = {
    onView: (view: PlaybackView) => void;
    onInteraction: () => void;
    resolveQueuedSelection: (id: string) => Promise<Omit<PlaylistSelection, "request"> | undefined>;
};

/** This controller owns only the player. It cannot fetch or adopt catalog data. */
export class PlaylistPlayer {
    private player?: YT.Player;
    private queued?: PlaylistSelection;
    private active?: PlaylistSelection;
    private initializing = false;
    private ready = false;
    private disposed = false;
    private generation = 0;
    private readyTimer?: ReturnType<typeof setTimeout>;
    private configureOnPlay = false;
    private state: PlaybackView["state"] = "idle";

    constructor(private host: HTMLElement, private options: PlayerOptions) {}

    /** Returns true when this click belongs to the existing player, rather than a new load. */
    toggle(id: string): boolean {
        if (this.disposed) return false;
        if (this.initializing && this.queued?.id === id) return true;
        if (!this.ready || !this.player || this.active?.id !== id || this.state === "error") return false;
        try {
            const state = this.player.getPlayerState();
            if (this.state !== "paused" && (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING)) this.player.pauseVideo();
            else this.player.playVideo();
        } catch {
            this.updateView({state: "error", name: this.active.name, id,
                message: "Unable to change playback. Select this playlist again to retry."});
        }
        return true;
    }

    private updateView(view: PlaybackView): void {
        this.state = view.state;
        this.options.onView(view);
    }

    play(selection: PlaylistSelection): void {
        if (this.disposed) return;
        this.queued = selection;
        if (this.ready) return this.loadQueued();
        this.updateView({state: "loading", name: selection.name, id: selection.id});
        if (!this.initializing) void this.initialize();
    }

    private fail(message: string): void {
        if (this.disposed) return;
        this.generation += 1;
        clearTimeout(this.readyTimer);
        this.ready = this.initializing = false;
        try { this.player?.destroy(); } catch { /* Cleanup remains best effort. */ }
        this.player = undefined;
        this.host.replaceChildren();
        this.updateView({state: "error", name: this.queued?.name || this.active?.name, id: this.queued?.id || this.active?.id, message});
    }

    private async initialize(): Promise<void> {
        this.initializing = true;
        const generation = ++this.generation;
        const current = () => !this.disposed && generation === this.generation;
        try {
            const api = await loadYouTubeApi();
            if (!current()) return;
            const element = document.createElement("div");
            this.host.replaceChildren(element);
            this.readyTimer = setTimeout(() => {
                if (current()) this.fail("The video player did not become ready. Select a playlist to retry.");
            }, 15000);
            const player = new api.Player(element, {
                width: "100%", height: "100%",
                playerVars: {autoplay: 1, loop: 1, enablejsapi: 1, playsinline: 1},
                events: {
                    onReady: (event) => {
                        if (!current()) return;
                        clearTimeout(this.readyTimer);
                        this.player = event.target || this.player;
                        this.ready = true;
                        this.initializing = false;
                        this.options.onInteraction();
                        void this.loadReadySelection(generation);
                    },
                    onStateChange: (event) => {
                        if (!current()) return;
                        this.options.onInteraction();
                        if (event.data === api.PlayerState.PLAYING && this.configureOnPlay) {
                            this.configureOnPlay = false;
                            try { this.player?.setShuffle(!this.active?.name.toLowerCase().includes("boss")); } catch { /* Optional player setting. */ }
                            try { this.player?.setLoop(true); } catch { /* Optional player setting. */ }
                        }
                        const state = event.data === api.PlayerState.PLAYING ? "playing" : event.data === api.PlayerState.PAUSED ? "paused" : "buffering";
                        this.updateView({state, name: this.active?.name, id: this.active?.id});
                    },
                    onPlaybackRateChange: () => { if (current()) this.options.onInteraction(); },
                    onAutoplayBlocked: () => {
                        if (!current()) return;
                        this.options.onInteraction();
                        this.updateView({state: "paused", name: this.active?.name, id: this.active?.id,
                            message: "Press Play in the video player to start playback."});
                    },
                    onError: () => {
                        if (!current()) return;
                        this.options.onInteraction();
                        try { this.player?.nextVideo(); } catch {
                            this.updateView({state: "error", name: this.active?.name, id: this.active?.id, message: "Unable to skip this video. Select a playlist to retry."});
                        }
                    }
                }
            });
            if (current()) this.player = player;
            else player.destroy();
        } catch {
            if (current()) this.fail("The video player could not load. Select a playlist to retry.");
        }
    }

    private async loadReadySelection(generation: number): Promise<void> {
        const queued = this.queued;
        if (!queued) return;
        try {
            const latest = await this.options.resolveQueuedSelection(queued.id);
            if (this.disposed || generation !== this.generation || this.queued?.request !== queued.request) return;
            if (!latest) {
                this.queued = undefined;
                this.updateView({state: "error", message: "That playlist is no longer available. Please choose another."});
                return;
            }
            this.queued = {...latest, request: queued.request};
            this.loadQueued();
        } catch {
            if (!this.disposed && generation === this.generation && this.queued?.request === queued.request) {
                this.updateView({state: "error", message: "Unable to select that playlist. Please try again."});
            }
        }
    }

    private loadQueued(): void {
        if (!this.player || !this.queued || !this.ready || this.disposed) return;
        const selection = this.queued;
        this.queued = undefined;
        this.active = selection;
        this.configureOnPlay = true;
        try { this.player.stopVideo(); } catch { /* A fresh player may not have a video yet. */ }
        this.updateView({state: "buffering", name: selection.name, id: selection.id});
        try {
            this.player.loadPlaylist({
                listType: "playlist", suggestedQuality: "hd720", list: selection.id,
                index: selection.name.toLowerCase().includes("boss") ? 0 : Math.floor(Math.random() * Math.max(1, selection.count))
            });
        } catch {
            this.updateView({state: "error", name: selection.name, id: selection.id, message: "Unable to load this playlist. Select it again to retry."});
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        clearTimeout(this.readyTimer);
        try { this.player?.destroy(); } catch { /* Cleanup remains best effort. */ }
        this.player = undefined;
        this.queued = undefined;
        this.host.replaceChildren();
    }
}
