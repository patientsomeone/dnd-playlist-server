import {loadYouTubeApi} from "./youtubeApi";

export type PlayerAudio = {volume: number; muted: boolean;};
export type PlaylistSelection = {id: string; name: string; count: number; request: number; audio?: PlayerAudio;};
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
    private pauseRequested = false;
    private pausePending = false;

    constructor(private host: HTMLElement, private options: PlayerOptions) {}

    /** Returns true when this click belongs to the existing player, rather than a new load. */
    toggle(id: string): boolean {
        if (this.disposed) return false;
        if (this.initializing && this.queued?.id === id) return this.pauseRequested ? this.resume() : this.pause();
        if (!this.ready || !this.player || this.active?.id !== id || this.state === "error") return false;
        try {
            const state = this.player.getPlayerState();
            if (!this.pauseRequested && this.state !== "paused" && (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING)) return this.pause();
            return this.resume();
        } catch {
            this.updateView({state: "error", name: this.active.name, id,
                message: "Unable to change playback. Select this playlist again to retry."});
        }
        return true;
    }

    pause(): boolean { return this.control(true); }
    resume(): boolean { return this.control(false); }

    getAudio(): PlayerAudio | undefined {
        if (!this.ready || !this.player || this.disposed) return undefined;
        try {
            const volume = this.player.getVolume();
            return Number.isFinite(volume) ? {volume: Math.max(0, Math.min(100, Math.round(volume))), muted: this.player.isMuted()} : undefined;
        } catch { return undefined; }
    }

    private applyAudio(audio?: PlayerAudio): void {
        if (!audio || !this.player) return;
        try {
            this.player.setVolume(audio.volume);
            if (audio.muted) this.player.mute(); else this.player.unMute();
        } catch { /* Optional audio controls must not prevent playback. */ }
    }

    private control(paused: boolean): boolean {
        const selection = this.queued || this.active;
        if (this.disposed || !selection || this.state === "error") return false;
        this.pauseRequested = paused;
        this.pausePending = paused && this.ready;
        try {
            if (paused) {
                // YouTube may delay PAUSED, or keep emitting BUFFERING, while a pause is pending.
                this.updateView({state: "paused", name: selection.name, id: selection.id});
                if (this.ready) this.player?.pauseVideo();
            } else if (this.ready && this.player) {
                this.player.playVideo();
                if (this.player.getPlayerState() !== YT.PlayerState.PLAYING) this.updateView({state: "buffering", name: selection.name, id: selection.id});
            } else this.updateView({state: "loading", name: selection.name, id: selection.id});
        } catch {
            this.updateView({state: "error", name: selection.name, id: selection.id,
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
        this.pauseRequested = false;
        this.pausePending = false;
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
                playerVars: {autoplay: 0, loop: 1, enablejsapi: 1, playsinline: 1},
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
                        if (this.pausePending && event.data === api.PlayerState.PLAYING) {
                            // A late PLAYING after pause must not reverse an explicit deck swap.
                            this.pause();
                            return;
                        }
                        if (this.pauseRequested && event.data !== api.PlayerState.PLAYING && event.data !== api.PlayerState.PAUSED) return;
                        if (event.data === api.PlayerState.PLAYING || event.data === api.PlayerState.PAUSED) this.pauseRequested = this.pausePending = false;
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
                        this.pauseRequested = true;
                        this.pausePending = false;
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
            this.queued = {...latest, request: queued.request, audio: queued.audio};
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
        this.applyAudio(selection.audio);
        const paused = this.pauseRequested;
        try { this.player.stopVideo(); } catch { /* A fresh player may not have a video yet. */ }
        this.pauseRequested = paused;
        this.updateView({state: this.pauseRequested ? "paused" : "buffering", name: selection.name, id: selection.id});
        try {
            const playlist = {
                listType: "playlist" as const, suggestedQuality: "hd720" as const, list: selection.id,
                index: selection.name.toLowerCase().includes("boss") ? 0 : Math.floor(Math.random() * Math.max(1, selection.count))
            };
            if (this.pauseRequested) { this.pausePending = false; this.player.cuePlaylist(playlist); }
            else this.player.loadPlaylist(playlist);
        } catch {
            this.updateView({state: "error", name: selection.name, id: selection.id, message: "Unable to load this playlist. Select it again to retry."});
        }
    }

    clear(): void {
        if (this.disposed) return;
        this.release();
        this.updateView({state: "idle"});
    }

    private release(): void {
        this.generation += 1;
        clearTimeout(this.readyTimer);
        this.ready = this.initializing = this.pauseRequested = this.pausePending = this.configureOnPlay = false;
        try { this.player?.destroy(); } catch { /* Cleanup remains best effort. */ }
        this.player = undefined;
        this.queued = undefined;
        this.active = undefined;
        this.host.replaceChildren();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.release();
    }
}
