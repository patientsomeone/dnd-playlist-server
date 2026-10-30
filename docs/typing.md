# Strict TypeScript and YouTube integration

`strict: true` is enabled in the shared compiler base and inherited by the server, legacy browser, React client, shared, Jest, and Playwright projects. This includes implicit-any, nullability, callback variance, property initialization, and unknown catch-variable checks. No strict subflags are disabled, declaration checking is not skipped, and application code does not use `@ts-ignore` / `@ts-nocheck` to pass the build. Strict mode still permits intentional explicit `any` in generic legacy JSON/analytics boundaries; it is no longer used for the YouTube player or its events.

## The two YouTube APIs

| Surface | Source of types | Usage |
| --- | --- | --- |
| Server REST/Data API | Built-in `@googleapis/youtube` declarations (`youtube_v3`) | Playlist pagination, metadata, item counts |
| Browser IFrame API | `@types/youtube`, enabled by the `youtube` tsconfig types entry | `YT.Player`, player options, playlist settings, events |

The Data API and IFrame API have different contracts. Installing the REST SDK does not type the browser player. Neither the player namespace nor the server SDK should be bundled into the other environment merely to satisfy TypeScript.

## Server response normalization

The SDK accurately marks many fields nullable/optional. Asking for `part: ["snippet"]` does not make TypeScript assume every result has `snippet`, `id`, or a title. The active fetcher checks IDs and titles before creating the application's required-field playlist records. Missing item collections become empty arrays; missing count details are skipped. Malformed required playlist fields still reject the refresh and preserve the previous committed cache.

The retained count CLIs now use the same nullable-field guards, default omitted item arrays, and reject playlist URLs with no `list` parameter. They do not cast an optional ID into a required string.

Use the SDK types for raw responses, then normalize the fields the app needs. Avoid redefining all of Google's response shapes or asserting the complete raw payload is already a processed catalog.

## Browser script loading and events

The IFrame script is loaded asynchronously, so the Window properties reflect absence:

```ts
interface Window {
    YT?: typeof YT;
    player?: YT.Player;
    onYouTubeIframeAPIReady: () => void;
}
```

The ambient `YT` namespace is supplied by `@types/youtube`; this declaration emits no runtime import. Initialization captures and checks `window.YT` before constructing its Player. Playback checks the player reference, while the existing ready/queued-selection flow remains intact. State events use `YT.OnStateChangeEvent`, and ready events use `YT.PlayerEvent`. Promise-returning work inside a void player callback is started with an explicit rejection handler.

The player options and `loadPlaylist` calls now compile against the published signatures. Numeric player parameters such as `autoplay: 1`, playlist IDs, quality strings, and state values need no blanket `any` override. See [the official IFrame lifecycle and event reference](https://developers.google.com/youtube/iframe_api_reference).

## Verification

`tests/youtube-types.contract.ts` is compile-only and included in `npm run test:types`. Its valid options/calls must compile, while described `@ts-expect-error` cases must reject numeric playlist IDs, string player states, and unchecked nullable REST fields. An accidental regression of the Window player or SDK data to `any` makes these checks fail with unused expected-error directives. The module is never executed, so negative checks make no requests and do not import the DOM-mutating browser entry at runtime.

`npm run test:all` checks all four strict source projects plus Jest and browser projects, lint, coverage, 167 Jest tests and 69 Chromium tests. Tests use Node 24's `Promise.withResolvers` for deferred gates; the Node-run test targets are ES2024 while the application/browser bundle target remains ES2020. Production build/start/runtime checks also pass. No live YouTube quota was consumed.

Strict checking exposed real behavior problems that now have regression coverage: async iteration propagates error-first callback failures, the lazy file writer awaits initialization, and `LoadUrl.single` rejects failures instead of returning an undeclared `undefined`. Generic duration keys and nullable/cache error paths are typed without changing the 12-hour policy or the legacy duration formatting boundaries.

The server/client builds are separate and the preview is [mounted at `/react`](react-client.md). The catalog hook and private typed YouTube player are now implemented and browser-tested, including StrictMode cleanup and late callback fencing. Real-media acceptance is next; no legacy route cutover was performed.
