import {emptyDeck, PlaylistDeck, type DeckView, type PlayerControls, type PlayerSlot} from "../client/src/player/PlaylistDeck";
import type {PlaylistSelection} from "../client/src/player/PlaylistPlayer";

const selection = (id: string): Omit<PlaylistSelection, "request"> => ({id, name: id, count: 3});

function setup() {
    let view: DeckView = emptyDeck();
    const players = ([0, 1] as const).map(() => ({toggle: jest.fn(() => true), pause: jest.fn(() => true), resume: jest.fn(() => true), clear: jest.fn(),
        getAudio: jest.fn(() => ({volume: 37, muted: false}))}));
    const resolveSelection = jest.fn(async (id: string) => selection(id));
    const interaction = jest.fn();
    const deck = new PlaylistDeck({controls: (slot) => players[slot], resolveSelection,
        onInteraction: interaction, onView: (next) => { view = next; }});
    const playing = (slot: PlayerSlot, id: string) => deck.updatePlayer(slot, {state: "playing", id, name: id});
    return {deck, players, resolveSelection, interaction, playing, view: () => view};
}

test("Add keeps the main player running and Swap reuses both saved selections", async () => {
    const state = setup();
    await state.deck.select("explore");
    state.playing(0, "explore");
    await state.deck.add("combat");
    state.playing(1, "combat");
    expect(state.players[0].pause).not.toHaveBeenCalled();
    expect(state.view().primary).toBe(0);
    const selections = state.view().selections;
    await state.deck.swap("combat");
    expect(state.players[0].pause).toHaveBeenCalledTimes(1);
    expect(state.players[1].resume).toHaveBeenCalledTimes(1);
    expect(state.view().primary).toBe(1);
    await state.deck.swap("explore");
    expect(state.players[1].pause).toHaveBeenCalledTimes(1);
    expect(state.players[0].resume).toHaveBeenCalledTimes(1);
    expect(state.view().primary).toBe(0);
    expect(state.view().selections).toBe(selections);
    expect(state.resolveSelection).toHaveBeenCalledTimes(2);
});

test("clicking either loaded playlist toggles its own controls", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.add("rain");
    await state.deck.select("rain");
    expect(state.players[1].toggle).toHaveBeenCalledWith("rain");
    expect(state.players[0].toggle).not.toHaveBeenCalled();
    expect(state.resolveSelection).toHaveBeenCalledTimes(2);
});

test("the sole playing player is promoted, while two simultaneous players retain their order", async () => {
    const state = setup();
    await state.deck.select("explore");
    state.playing(0, "explore");
    await state.deck.add("rain");
    state.playing(1, "rain");
    expect(state.view().primary).toBe(0);
    state.deck.updatePlayer(0, {state: "paused", id: "explore", name: "explore"});
    expect(state.view().primary).toBe(1);
    state.playing(0, "explore");
    expect(state.view().primary).toBe(1);
});

test("swapping to a third playlist replaces the secondary and parks the current main", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.add("rain");
    await state.deck.swap("combat");
    expect(state.view().primary).toBe(1);
    expect(state.view().selections.map((value) => value?.id)).toEqual(["explore", "combat"]);
    expect(state.players[0].pause).toHaveBeenCalledTimes(1);
});

test("an in-flight Swap cannot override a subsequent current-playlist toggle", async () => {
    const state = setup();
    await state.deck.select("explore");
    const pending = Promise.withResolvers<Omit<PlaylistSelection, "request">>();
    state.resolveSelection.mockReturnValueOnce(pending.promise);
    const swap = state.deck.swap("combat");
    await state.deck.select("explore");
    pending.resolve(selection("combat"));
    await swap;
    expect(state.view().selections[1]).toBeUndefined();
    expect(state.view().message).toBeUndefined();
    expect(state.players[0].pause).not.toHaveBeenCalled();
});

test("a delayed Add still targets the secondary if native playback changes the primary", async () => {
    const state = setup();
    await state.deck.select("explore");
    state.playing(0, "explore");
    await state.deck.add("rain");
    state.playing(1, "rain");
    const pending = Promise.withResolvers<Omit<PlaylistSelection, "request">>();
    state.resolveSelection.mockReturnValueOnce(pending.promise);
    const add = state.deck.add("combat");
    state.deck.updatePlayer(0, {state: "paused", id: "explore", name: "explore"});
    pending.resolve(selection("combat"));
    await add;
    expect(state.view().primary).toBe(1);
    expect(state.view().selections.map((value) => value?.id)).toEqual(["combat", "rain"]);
});

test("disposal fences late catalog replies and player events", async () => {
    const state = setup();
    const pending = Promise.withResolvers<Omit<PlaylistSelection, "request">>();
    state.resolveSelection.mockReturnValueOnce(pending.promise);
    const add = state.deck.add("rain");
    const before = state.view();
    state.deck.dispose();
    pending.resolve(selection("rain"));
    await add;
    state.playing(1, "rain");
    expect(state.view()).toBe(before);
});

test("a missing playlist or failed lookup preserves both current selections", async () => {
    let view = emptyDeck();
    const controls: PlayerControls = {toggle: () => true, pause: () => true, resume: () => true, clear: () => undefined, getAudio: () => undefined};
    const deck = new PlaylistDeck({controls: () => controls, onInteraction: () => undefined,
        onView: (next) => { view = next; }, resolveSelection: async () => undefined});
    await deck.swap("missing");
    expect(view.message).toContain("no longer available");
    expect(view.selections).toEqual([undefined, undefined]);
});

test("removing the secondary clears only its slot and cancels an in-flight replacement", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.add("rain");
    const pending = Promise.withResolvers<Omit<PlaylistSelection, "request">>();
    state.resolveSelection.mockReturnValueOnce(pending.promise);
    const add = state.deck.add("combat");
    state.deck.remove("rain");
    pending.resolve(selection("combat"));
    await add;
    expect(state.view().selections.map((value) => value?.id)).toEqual(["explore", undefined]);
    expect(state.view().playback[1]).toEqual({state: "idle"});
    expect(state.players[1].clear).toHaveBeenCalledTimes(1);
    expect(state.players[0].clear).not.toHaveBeenCalled();
});

test("removing the main promotes the remaining player without changing its playback", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.add("rain");
    state.playing(1, "rain");
    state.deck.remove("explore");
    expect(state.view().primary).toBe(1);
    expect(state.view().playback[1]).toEqual({state: "playing", id: "rain", name: "rain"});
    expect(state.players[1].resume).not.toHaveBeenCalled();
    state.deck.remove("rain");
    expect(state.view()).toEqual(emptyDeck());
});

test("clicking a parked Swap playlist reverses the swap rather than enabling independent playback", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.swap("combat");
    expect(state.view().mode).toBe("swapped");
    await state.deck.select("explore");
    expect(state.players[1].pause).toHaveBeenCalledTimes(1);
    expect(state.players[0].resume).toHaveBeenCalledTimes(1);
    expect(state.players[0].toggle).not.toHaveBeenCalled();
    expect(state.view().primary).toBe(0);
    expect(state.view().mode).toBe("swapped");
    expect(state.resolveSelection).toHaveBeenCalledTimes(2);
});

test("clicking the currently playing Swap row also switches the pair instead of pausing independently", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.swap("combat");
    await state.deck.select("combat");
    expect(state.view().primary).toBe(0);
    expect(state.players[1].pause).toHaveBeenCalledTimes(1);
    expect(state.players[0].resume).toHaveBeenCalledTimes(1);
    expect(state.players[1].toggle).not.toHaveBeenCalled();
});

test("Add replaces only the parked slot, switches back to independent mode and copies main audio", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.swap("combat");
    state.players[1].getAudio.mockReturnValue({volume: 0, muted: true});
    await state.deck.add("rain");
    expect(state.view().mode).toBe("added");
    expect(state.view().primary).toBe(1);
    expect(state.view().selections[0]).toMatchObject({id: "rain", audio: {volume: 0, muted: true}});
    expect(state.players[1].pause).not.toHaveBeenCalled();
    await state.deck.select("rain");
    expect(state.players[0].toggle).toHaveBeenCalledWith("rain");
});

test("native playback can run both hot-swapped streams while row selection still swaps them", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.swap("combat");
    state.playing(1, "combat");
    state.playing(0, "explore");
    expect(state.view().primary).toBe(1);
    expect(state.players[1].pause).not.toHaveBeenCalled();
    expect(state.view().playback.map((value) => value.state)).toEqual(["playing", "playing"]);
    await state.deck.select("explore");
    expect(state.players[1].pause).toHaveBeenCalledTimes(1);
    expect(state.view().primary).toBe(0);
});

test("header transport toggles its own player in Swap mode while a row still reverses the pair", async () => {
    const state = setup();
    await state.deck.select("explore");
    await state.deck.swap("combat");
    state.playing(1, "combat");
    state.deck.updatePlayer(0, {state: "paused", id: "explore", name: "explore"});
    await state.deck.togglePlayer(1);
    expect(state.players[1].toggle).toHaveBeenCalledWith("combat");
    expect(state.players[0].resume).not.toHaveBeenCalled();
    expect(state.view().primary).toBe(1);
    await state.deck.togglePlayer(0);
    expect(state.players[1].pause).not.toHaveBeenCalled();
    expect(state.players[0].toggle).toHaveBeenCalledWith("explore");
    expect(state.view().primary).toBe(1);
    expect(state.view().mode).toBe("swapped");
    await state.deck.select("explore");
    expect(state.players[1].pause).toHaveBeenCalledTimes(1);
    expect(state.players[0].resume).toHaveBeenCalledTimes(1);
    expect(state.view().primary).toBe(0);
    expect(state.resolveSelection).toHaveBeenCalledTimes(2);
});
