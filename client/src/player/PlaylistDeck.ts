import type {PlaylistSelection, PlaybackView, PlayerAudio} from "./PlaylistPlayer";

export type PlayerSlot = 0 | 1;
export type PlayerControls = {
    toggle: (id: string) => boolean;
    pause: () => boolean;
    resume: () => boolean;
    clear: () => void;
    getAudio: () => PlayerAudio | undefined;
};
export type DeckView = {
    primary: PlayerSlot;
    mode: "single" | "added" | "swapped";
    selections: [PlaylistSelection | undefined, PlaylistSelection | undefined];
    playback: [PlaybackView, PlaybackView];
    message?: string;
};
type Options = {
    controls: (slot: PlayerSlot) => PlayerControls | null;
    resolveSelection: (id: string) => Promise<Omit<PlaylistSelection, "request"> | undefined>;
    onView: (view: DeckView) => void;
    onInteraction: () => void;
};

export function emptyDeck(): DeckView {
    return {primary: 0, mode: "single", selections: [undefined, undefined], playback: [{state: "idle"}, {state: "idle"}]};
}

/** Coordinates two stable player instances; changing primary never moves an iframe in the DOM. */
export class PlaylistDeck {
    private view = emptyDeck();
    private request = 0;
    private disposed = false;

    constructor(private options: Options) {}

    private emit(): void { if (!this.disposed) this.options.onView(this.view); }

    private loaded(id: string): PlayerSlot | undefined {
        return this.view.selections[0]?.id === id ? 0 : this.view.selections[1]?.id === id ? 1 : undefined;
    }

    updatePlayer(slot: PlayerSlot, playback: PlaybackView): void {
        if (this.disposed) return;
        const views: DeckView["playback"] = [...this.view.playback];
        views[slot] = playback;
        let primary = this.view.primary;
        const other = primary === 0 ? 1 : 0;
        if (views[other].state === "playing" && ["idle", "paused", "error"].includes(views[primary].state)) primary = other;
        this.view = {...this.view, playback: views, primary};
        // Native iframe controls must respect exclusive Swap mode too.
        const opposite = slot === 0 ? 1 : 0;
        if (this.view.mode === "swapped" && playback.state === "playing" && this.view.selections[opposite]) {
            this.view = {...this.view, primary: slot};
            if (["playing", "buffering", "loading"].includes(this.view.playback[opposite].state)) this.options.controls(opposite)?.pause();
        }
        this.emit();
    }

    private touch(): void {
        this.request += 1;
        this.view = {...this.view, message: undefined};
        this.options.onInteraction();
    }

    async select(id: string): Promise<void> {
        if (this.disposed) return;
        const slot = this.loaded(id);
        if (slot !== undefined && this.view.mode === "swapped") {
            const target = slot === this.view.primary ? this.view.selections[slot === 0 ? 1 : 0]?.id : id;
            if (target) return this.swap(target);
        }
        this.touch();
        if (slot !== undefined && this.options.controls(slot)?.toggle(id)) return this.emit();
        await this.load(id, slot ?? "main", false);
    }

    async add(id: string): Promise<void> {
        if (this.disposed) return;
        this.touch();
        const loaded = this.loaded(id);
        if (loaded !== undefined) {
            this.view = {...this.view, mode: this.view.selections.every(Boolean) ? "added" : "single"};
            this.options.controls(loaded)?.resume();
            return this.emit();
        }
        await this.load(id, "secondary", false);
    }

    async swap(id: string): Promise<void> {
        if (this.disposed) return;
        this.touch();
        const slot = this.loaded(id);
        if (slot !== undefined && this.view.playback[slot].state !== "error") {
            if (slot === this.view.primary) return this.emit();
            this.view = {...this.view, mode: "swapped"};
            this.options.controls(this.view.primary)?.pause();
            this.view = {...this.view, primary: slot};
            this.options.controls(slot)?.resume();
            return this.emit();
        }
        await this.load(id, slot ?? "secondary", true);
    }

    remove(id: string): void {
        if (this.disposed) return;
        const slot = this.loaded(id);
        if (slot === undefined) return;
        this.touch();
        const selections: DeckView["selections"] = [...this.view.selections];
        const playback: DeckView["playback"] = [...this.view.playback];
        selections[slot] = undefined;
        playback[slot] = {state: "idle"};
        const other = slot === 0 ? 1 : 0;
        const primary = slot === this.view.primary ? (selections[other] ? other : 0) : this.view.primary;
        this.view = {...this.view, selections, playback, primary, mode: "single"};
        this.options.controls(slot)?.clear();
        this.emit();
    }

    swapPlayers(): void {
        const secondary = this.view.primary === 0 ? 1 : 0;
        const id = this.view.selections[secondary]?.id;
        if (id) void this.swap(id);
    }

    async togglePlayer(slot: PlayerSlot): Promise<void> {
        if (this.disposed) return;
        const id = this.view.selections[slot]?.id;
        if (!id) return;
        this.touch();
        // Header transport controls target this player; list rows can switch the pair.
        if (this.view.mode === "swapped" && ["paused", "idle", "error"].includes(this.view.playback[slot].state)) {
            this.view = {...this.view, primary: slot};
            const other = slot === 0 ? 1 : 0;
            if (["playing", "buffering", "loading"].includes(this.view.playback[other].state)) this.options.controls(other)?.pause();
        }
        if (this.options.controls(slot)?.toggle(id)) return this.emit();
        await this.load(id, slot, false);
    }

    private async load(id: string, destination: PlayerSlot | "main" | "secondary", promote: boolean): Promise<void> {
        const request = this.request;
        this.view = {...this.view, message: "Loading latest playlists..."};
        this.emit();
        try {
            const latest = await this.options.resolveSelection(id);
            if (this.disposed || request !== this.request) return;
            if (!latest) {
                this.view = {...this.view, message: "That playlist is no longer available. Please choose another."};
                return this.emit();
            }
            const slot = destination === "main" ? this.view.primary : destination === "secondary" ? (this.view.primary === 0 ? 1 : 0) : destination;
            const audio = destination === "secondary" && !promote ? this.options.controls(this.view.primary)?.getAudio() : undefined;
            if (promote) this.view = {...this.view, mode: "swapped"};
            if (promote && slot !== this.view.primary) this.options.controls(this.view.primary)?.pause();
            const selections: DeckView["selections"] = [...this.view.selections];
            const playback: DeckView["playback"] = [...this.view.playback];
            selections[slot] = {...latest, request, audio};
            playback[slot] = {state: "loading", id, name: latest.name};
            const mode = !selections.every(Boolean) ? "single" : destination === "secondary" && !promote ? "added" : this.view.mode;
            this.view = {...this.view, selections, playback, mode, primary: promote ? slot : this.view.primary, message: undefined};
            try { window.gtag?.("event", "click", {event_category: "button", event_label: latest.name}); } catch { /* Analytics is optional. */ }
            this.emit();
        } catch {
            if (this.disposed || request !== this.request) return;
            this.view = {...this.view, message: "Unable to select that playlist. Please try again."};
            this.emit();
        }
    }

    clearMessage(): void { this.view = {...this.view, message: undefined}; this.emit(); }
    dispose(): void { this.disposed = true; this.request += 1; }
}
