import {useEffect, useImperativeHandle, useRef, type ReactNode, type Ref} from "react";
import {PlaylistPlayer, playbackLabels, type PlaylistSelection, type PlaybackView} from "../player/PlaylistPlayer";

export type PlaybackControls = Pick<PlaylistPlayer, "toggle">;
type Props = {
    ref?: Ref<PlaybackControls>;
    selection?: PlaylistSelection;
    view: PlaybackView;
    headingAction?: ReactNode;
    onPlaybackChange: (view: PlaybackView) => void;
    onInteraction: () => void;
    resolveSelection: (id: string) => Promise<Omit<PlaylistSelection, "request"> | undefined>;
};

export function YouTubePlayer({ref, selection, view, headingAction, onPlaybackChange, onInteraction, resolveSelection}: Props) {
    const host = useRef<HTMLDivElement>(null);
    const controller = useRef<PlaylistPlayer | undefined>(undefined);
    useImperativeHandle(ref, () => ({toggle: (id) => controller.current?.toggle(id) || false}), []);

    useEffect(() => {
        if (!host.current) return;
        const player = new PlaylistPlayer(host.current, {onView: onPlaybackChange, onInteraction, resolveQueuedSelection: resolveSelection});
        controller.current = player;
        const hide = (event: PageTransitionEvent) => { if (!event.persisted) player.dispose(); };
        window.addEventListener("pagehide", hide);
        return () => {
            window.removeEventListener("pagehide", hide);
            player.dispose();
            if (controller.current === player) controller.current = undefined;
        };
    }, [onInteraction, resolveSelection, onPlaybackChange]);

    useEffect(() => {
        if (selection) controller.current?.play(selection);
    }, [selection]);

    const label = playbackLabels[view.state];
    return (
        <section id="frameParent" aria-label="Video player" onPointerDown={onInteraction} onKeyDown={onInteraction}>
            <div className="player-toolbar" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <h2 className={view.state} aria-live="polite">{label}{view.name ? ": " + view.name : ""}</h2>
                {headingAction}
            </div>
            {view.message && <p role={view.state === "error" ? "alert" : "status"}>{view.message}</p>}
            <div className="player-stage">
                <div className="player-host" ref={host}/>
                {view.state === "idle" && !selection && <p className="player-placeholder">No Playlist Selected</p>}
            </div>
        </section>
    );
}
