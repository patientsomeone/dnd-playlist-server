# Separate server and browser builds

The repo uses one npm install and esbuild for both browser targets. Express remains the shared API server. There is no second API server, React server renderer, Vite process, or second deployment in this change.

## Commands and outputs

| Command | Inputs | Owned output |
| --- | --- | --- |
| `npm run build:server` | Server code in `src`, plus shared modules | `dist/server` |
| `npm run build:legacy` | `src/agents/createList.ts`, catalog controller/IndexedDB and shared modules | `public/createList.js` and `.map` |
| `npm run build:client` | `client/src/main.tsx`, React components and shared modules | `dist/client/index.html`, `dist/client/assets` |
| `npm run build` | Server, legacy, then React client | All of the above; stops on failure |
| `npm start` | Built server | Runs `dist/server/routes/app.js` |
| `npm run dev` | Source | Strict checks, initial browser builds, watchers, then API on port 8000 |
| `npm run dev:server` | Server source only | Nodemon with the server TypeScript project |
| `npm run dev:watch` | Both browser entries and client HTML | Browser watch output only |

`bundle:createList` remains an alias for the checked legacy build. Build metadata is saved separately in `dist/build-info` for inspection. Individual builds clean only their own server/client output; the legacy build overwrites its two generated files and never clears `public`. Data stays at `data/playlist-cache.sqlite`, with the existing `PLAYLIST_CACHE_DB_PATH` override and legacy JSON import rules.

`dist` is generated output. Old flat compiler output was removed locally after the new entry passed its checks. New builds leave sibling outputs intact; do not restore the old `node dist/routes/app.js` startup path. DigitalOcean still uses `npm run build` and `npm start`, so its App Spec commands do not need to change.

## Source and type boundaries

- `client/src` owns the React components, shared-catalog hook, private YouTube player controller/API loader, scoped styles and browser `createRoot` entry. `client/index.html` references `/react/assets/main.js`. The root Vite scaffold that referenced missing files has been retired.
- `src/client` owns reusable browser catalog/IndexedDB services; both UIs can import them. The legacy entry remains in its original source location to preserve existing asset URLs and test coverage.
- `src/shared/playlistTypes.ts` owns browser-safe playlist types; the old `.types.ts` re-exports them for server utility compatibility. Shared policy/parser modules import only shared types.
- The server's page registry contains titles only. It does not import React components. Unused server-rendering sample views and the duplicate registry were retired; their previous local versions were preserved in an ignored snapshot.
- Root `tsconfig.json` supplies the broad editor/test view. Independent checks/builds use strict `tsconfig.server.json`, `tsconfig.legacy.json`, `tsconfig.client.json`, and `tsconfig.shared.json`, all extending the strict base. `npm run typeTest` runs all four. Test projects additionally retain their explicit Node-24/ES2024 libraries.

The server project has Node libraries/types and no DOM/JSX target. Browser projects use DOM libraries and bundler module resolution without global Node types; the React client uses the automatic JSX transform. Shared code checks with ES2020 libraries and no platform types. The browser bundler also rejects server source/dependencies and private/public cache files, so an explicit import cannot quietly pull them into client output. Dependencies such as React are bundled through their browser entry points.

Repository paths are found from the application package location rather than a fixed `src`/`dist` depth or the caller's working directory. This keeps static assets, local environment files, and default cache paths stable after the server output moves to `dist/server`.

## Development behavior

The dev runner starts each browser watch context once and waits for both initial builds before launching nodemon. HTML changes are copied into the client output. Client-only and legacy-browser-only changes rebuild their bundle without restarting the API; server/shared changes are scoped by nodemon's config. The source server uses `tsconfig.server.json` and never waits for a production `dist/server` build. There is no initial combined production build followed by duplicate watch builds.

Dev output uses React's development build; production client output is minified with the production runtime. Browser edits still require a page reload; no HMR is provided. Startup runs all strict source checks, while subsequent esbuild rebuilds transpile only. Run `npm run check` for ongoing full type/lint verification.

## Verification

`npm run test:build` copies source/build config into an owned temporary checkout, links the existing dependencies, and performs real builds and watch changes. It checks sibling output preservation, cache/lock/environment sentinel preservation, removal of stale files only within owned output, rejection of server/cache imports into the browser, failure propagation without TypeScript partial output, single initial browser builds, client/HTML rebuilds, and API restart behavior. It never edits the working application's cache or sources, and removes its dependency link before cleaning the fixture.

The standard 167 Jest tests / 69 Chromium tests and coverage gates pass. Built-entry startup runs from an unrelated directory with fixture credentials and an isolated database, then verifies the page, legacy bundle, metadata endpoint, and 404. Real runtime interop and a 1K actual-store benchmark smoke pass at the new output path. The GitHub Actions workflow repeats these checks on Ubuntu, including build isolation.

## Mounted preview and next conversion work

Express now serves `dist/client/index.html` at `/react` and `/react/`, with only the assets directory mounted under `/react/assets`. Unknown nested paths and missing assets retain 404s; the legacy root and shared API are preserved. See [route contracts and browser verification](react-client.md).

React now uses the shared catalog/IndexedDB hook and private YouTube player lifecycle, with explicit states, search and 100-row pages. Automated lifecycle/parity checks pass; real-media/manual acceptance and remote CI/host validation are next. No legacy cutover or deployment was performed.
