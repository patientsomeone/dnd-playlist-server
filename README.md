# D&D Playlist Organizer

A shared, alphabetically organized YouTube playlist catalog for a worldwide D&D group. Express serves the legacy player at `/`, a SQLite metadata cache, and the playlist API. The React player is mounted at `/react` and `/react/`, using the shared catalog/IndexedDB flow and an independent YouTube player. The legacy root remains available during acceptance testing.

## Setup

Use **Node 24.22.1** and **npm 11.19.1**, pinned by `.nvmrc`, `engines`, and `packageManager`. Newer Node 24.x / npm 11.x releases are allowed. Other Node majors are intentionally outside this project's tested runtime. Selecting a runtime is a manual step; installation does not change the machine's global Node selection.

With nvm-windows, select the project runtime in your terminal:

```sh
nvm install 24.22.1
nvm use 24.22.1
node --version
npm --version
npm ci
npm run test:browser:install
```

Create an ignored `.i.env` at the repository root with your own values. Host-provided environment variables take precedence; `.i.env` then takes precedence over an optional `.env`. Loading is centralized in `src/utilities/environment.ts`; secrets are never browser configuration.

| Variable | Purpose |
| --- | --- |
| `YT_API_KEY` | Server-side YouTube API key, required for refreshes |
| `YT_LIST_OWNER` | Default YouTube channel ID |
| `PORT` | HTTP listener; defaults to `8000` |
| `DO_ENV` | Existing truthy production/logging flag; supplied by DigitalOcean as `${APP_URL}` |
| `PLAYLIST_CACHE_DB_PATH` | Optional SQLite file path; default `data/playlist-cache.sqlite` |

Run `npm run dev`, then open `http://localhost:8000`. It checks all source type projects, builds each browser target once, then runs Express through nodemon with both browser watchers. The build works in PowerShell, Git Bash, and Linux without a Bash wrapper. The browser page requires reloading after a bundle change; this is not React HMR.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run test:all` | Lint, source/test/browser type checks, coverage-gated Jest, Chromium |
| `npm run check` | The same checks without Chromium |
| `npm run build` | Run the independent server, legacy, and React client builds |
| `npm run build:server` | Compile only server/shared code into `dist/server` |
| `npm run build:legacy` | Build the checked legacy bundle at its existing public URL |
| `npm run build:client` | Build the React player into `dist/client` |
| `npm start` | Run `dist/server/routes/app.js` |
| `npm run test:build` | Disposable real-build/watch checks for output/cache isolation and failure handling |
| `npm run test:client` | Chromium against the actual built Express React/legacy routes, with fixture API responses |
| `npm run test:start` | Built-server startup and HTTP smoke with fixture environment/temp cache |
| `npm run test:runtime` | Built-code interop with real Axios/cookies, YouTube SDK and native SQLite; loopback only |
| `npm run test:watch` | Jest watch mode |
| `npm run lint:fix` | Automatic fixes using the current ESLint policy |
| `npm run bench:sqlite` | Actual-store desktop benchmark at 1K/10K/100K playlists |

After changes, run `npm run test:all`, `npm run build`, `npm run test:start`, `npm run test:client`, `npm run test:runtime`, and `npm run test:build`. Chromium installation on Linux CI uses `npm run test:browser:install -- --with-deps`. Routine checks use fixtures and do not consume YouTube quota. See [test coverage and limits](tests/README.md) and [performance methodology](benchmarks/README.md).

`public/createList.js` and its source map are generated from `src/agents/createList.ts`; edit the TypeScript source. `dist/server` and `dist/client` are generated and independently disposable. The React player is mounted at `/react` and `/react/`; see [catalog/player behavior, checks and acceptance limits](docs/react-client.md). See [build layout and watchers](docs/builds.md). Retired Gulp/Git helper scripts are no longer npm commands; use Git directly for branch/commit/push operations.

## Cache and API

- `GET /listCount` returns the last committed catalog; `GET /refreshPlaylists` requests a refresh when the coded **12-hour** freshness interval has expired.
- `GET /cacheState` returns only channel timestamp/freshness/refresh-lease metadata, with no catalog scan or YouTube request.
- Browser IndexedDB displays saved catalogs immediately and revalidates in the background. Catalog updates do not reload or seek the player.
- Server refreshes replace channel snapshots transactionally and use expiring SQLite leases. Matching per-channel legacy JSON can import once; unrelated JSON and old `.lock` files are not used by the active cache.

SQLite files are server-side, private, and separate from build output. On DigitalOcean App Platform they remain an ephemeral cache and may be regenerated after replacement. Accounts/settings will need a durable storage design. See [server cache](docs/sqlite-cache.md) and [browser cache](docs/browser-cache.md).

## Deployment and rollback

The supplied DigitalOcean spec builds with `npm run build`, starts with `npm start`, uses HTTP port 8080, and deploys pushes to **`Production`**. Runtime pins now select Node 24; verify the actual selected Node/npm versions in the next staging/deployment logs. Local upgrade work has not been deployed. See [recorded settings and release boundary](docs/deployment.md).

Before release, review the complete change set against the current remote `Production` head and keep the last known working revision available. Roll back by redeploying that revision through DigitalOcean, including its matching manifest/lockfile/runtime. Cache data is rebuildable; preserve any valuable local snapshot separately before replacing instances. Never use the retired script that pushed `master` after compilation failures.

## Dependency policy

The [upgrade record](docs/dependency-audit.md) lists selected versions, checks, and remaining findings. TypeScript stays on **6.0.x** because the current typed-lint toolchain does not support 7.x; Node types stay on 24 to match the runtime. Strict checking is enabled for application source and both test projects; [the typing guide](docs/typing.md) explains YouTube response/player types and compile-only regression checks. Explicit `any` at generic integration boundaries remains allowed. ESLint's flat config owns formatting and promise checks, with React Hooks checks enabled.
