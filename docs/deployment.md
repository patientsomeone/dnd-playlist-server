# DigitalOcean deployment

Initial configuration came from the owner's redacted App Spec on October 29,
2026. Updated after the authorized first preview release on October 30, 2026.
This document records settings; it is not an App Spec to upload.

| Setting | Value |
| --- | --- |
| App | `playlist-organizer` |
| Service | `dnd-playlist-server` |
| Public URL | `https://playlist-organizer-2jtck.ondigitalocean.app/` |
| Platform / region | DigitalOcean App Platform / `sfo` |
| Repository | `patientsomeone/dnd-playlist-server` on GitHub |
| Deployed branch | **`master`** — switched for the first preview release; Git `Production` was not advanced |
| Automatic deployment | Enabled on pushes to the deployed branch |
| Instances | **1** |
| Instance plan | `apps-s-1vcpu-0.5gb` — 1 vCPU, 0.5 GB RAM |
| Build command | `npm run build` |
| Run command | `npm start` |
| Source directory | Repository root (`/`) |
| HTTP port | `8080` |
| Ingress | All paths under `/` route to this service |
| Build stack | `ubuntu-22`, Node.js environment |
| Attached databases | None declared in the supplied spec |

Configured application environment keys are `YT_API_KEY` (secret),
`YT_LIST_OWNER`, and `DO_ENV`. Secret values are intentionally not recorded.
The service also requires the following non-secret build-time setting:

```yaml
- key: npm_config_build_from_source
  scope: BUILD_TIME
  value: sqlite3
```

This makes SQLite compile against the build host's libraries. The downloaded
sqlite3 6.0.1 Linux binary required `GLIBC_2.38` and could not load on this Ubuntu
22 runtime. Compiling from source resolved the startup failure. Keep this setting
for future builds; the compiler/Python toolchain must be available in the build
image. Local Windows installs retain their normal prebuilt binary behavior.

The project supports Node 24.22.1 or newer 24.x and uses npm 11.19.1. The verified
DigitalOcean release selected Node **24.22.2** and npm **11.19.1**.

## Development and release boundary

React preparation was developed on `react-prep`. Tested feature changes are
merged into `master`; GitHub Actions checks pushes to both branches. The live
DigitalOcean app now watches **master with autodeploy enabled**. Pushing to
`master` is therefore a live deployment action even while Git `Production`
remains unchanged.

Before a release, compare the tested branch with the current remote `Production`
head and review the full change set. Local branch references alone may be stale.
A push/merge to `Production` is a deployment action and should happen deliberately.

The development server defaults to port 8000. Production's configured HTTP port
is 8080; keep `process.env.PORT` support and verify the runtime port value instead
of hard-coding a new development port.

The browser-rendered React preview is mounted at `/react` by this same
Express service while `/` continues serving the legacy UI. The current `/`
ingress already routes requests to Express. The client now builds separately into
`dist/client` with `/react/assets` URLs. Live host routes, assets and reloads were
verified during the first preview release below.

## First preview release: October 30, 2026

Released commit `09464b5fb471bbf6534defb1f9cc61b914e334c9` from `master`.
The initial configuration-only deployment selected the branch name but checked
out old commit `f85f9d3`. **Actions → Force rebuild and deploy** fetched the current
branch head. Its first attempt exposed the SQLite GLIBC incompatibility; adding
the build-time setting above produced a successful live deployment:
`52f62907-7bc5-4489-9ac1-638bf438c8c7`.

Verified on the public host:

- `/react`, `/react/`, the client JS/CSS, `/cacheState` and legacy `/` return 200.
- React HTML uses `no-store`; JS/CSS have the expected content types.
- The first cold cache refresh completed with **68 unique playlists**; the server
  reports a fresh cache with no held refresh lease.
- React's configured title, idle player, catalog and reload persistence work.
- Legacy displays the same 68 unique playlists and hides routine cache status.
- Both browser checks completed without page errors. Live media playback remains
  a separate manual acceptance check.

Git `Production` stayed at `5b5c076d039ee0e91a75adb6288524cf6ca85974`.

## Storage and performance constraints

App Platform's local filesystem is ephemeral and separate for each instance.
The current single-instance deployment avoids cross-instance cache coordination
for now. Both server-local JSON and SQLite remain rebuildable caches across
container replacement. The active cache is now `data/playlist-cache.sqlite`,
overridable with `PLAYLIST_CACHE_DB_PATH`; matching per-channel JSON files are
imported once. The unattributed tracked `public/json/listCount.json` is not used
as a channel seed. Missing channel data is rebuilt through the normal refresh.
See [DigitalOcean's storage model](https://docs.digitalocean.com/products/app-platform/how-to/store-data/).

SQLite now provides indexed per-channel rows, transactional replacement, and
expiring refresh leases. The legacy endpoints still return complete catalogs;
bounded paging/search is future work. See [cache operation and migration](sqlite-cache.md).
Future account records and user-created settings require a durable storage design before launch.

The developer's desktop is the agreed environment for ongoing
[performance baselines](../benchmarks/README.md). Measure latency, peak RSS/heap,
event-loop delay, concurrent requests, and reads during refresh there, keeping
workloads and hardware/runtime details comparable across changes. Emulating this
1-vCPU/0.5-GB deployment is not a prerequisite for development benchmarks.

When preparing a larger rollout, revisit DigitalOcean sizing and validate the
chosen tier against the expected workload. Account for Node, Express, SQLite
native allocations, and response serialization when budgeting total memory.

Use a disposable local/staging environment with synthetic catalogs for load
tests. The production group site and live YouTube quota are not benchmark targets.

The separated production build compiles the server into `dist/server`, preserves legacy assets, and builds the client into `dist/client`. `npm start` launches `dist/server/routes/app.js`. Package-root lookup keeps static/environment/cache paths stable at the new depth; see [build commands and verification](builds.md).

React route mounting is live: `/react` and `/react/` serve the client HTML, `/react/assets` serves only its asset directory, and unknown nested URLs return 404. The legacy root and API URLs remain in place. Advancing Git `Production` remains a separate release step; see [preview scope and checks](react-client.md).
