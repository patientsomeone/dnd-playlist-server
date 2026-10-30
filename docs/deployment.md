# DigitalOcean deployment

Confirmed from the redacted App Spec supplied by the owner on October 29, 2026.
No live account configuration was changed. This document is a record of settings,
not an App Spec to upload or deploy.

| Setting | Value |
| --- | --- |
| App | `playlist-organizer` |
| Service | `dnd-playlist-server` |
| Public URL | `https://playlist-organizer-2jtck.ondigitalocean.app/` |
| Platform / region | DigitalOcean App Platform / `sfo` |
| Repository | `patientsomeone/dnd-playlist-server` on GitHub |
| Deployed branch | **`Production`** (case-sensitive) |
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
The App Spec does not pin Node. The project now pins Node 24.22.1 / npm 11.19.1
through runtime configuration; verify the actual selected versions in the next
host build logs. Local validation passed; no deployment was performed.

## Development and release boundary

React preparation was developed on `react-prep`. Tested feature changes are
merged into `master`; GitHub Actions checks pushes to both branches. The supplied
deployment configuration watches `Production`, so merging into `master` does not
itself trigger that configured deployment.

Before a release, compare the tested branch with the current remote `Production`
head and review the full change set. Local branch references alone may be stale.
A push/merge to `Production` is a deployment action and should happen deliberately.

The development server defaults to port 8000. Production's configured HTTP port
is 8080; keep `process.env.PORT` support and verify the runtime port value instead
of hard-coding a new development port.

The browser-rendered React preview is now mounted locally at `/react` by this same
Express service while `/` continues serving the legacy UI. The current `/`
ingress already routes requests to Express. The client now builds separately into
`dist/client` with `/react/assets` URLs. Local built-app route/reload checks pass; validate actual host routing before sharing a deployment.

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

The separated production build compiles the server into `dist/server`, preserves legacy assets, and builds the client into `dist/client`. `npm start` now launches `dist/server/routes/app.js`. Package-root lookup keeps static/environment/cache paths stable at the new depth. No App Spec change or deployment was performed; see [build commands and verification](builds.md).

React route mounting is implemented: `/react` and `/react/` serve the client HTML, `/react/assets` serves only its asset directory, and unknown nested URLs return 404. The legacy root and API URLs remain in place. Deployment to `Production` remains a separate release step; see [preview scope and checks](react-client.md).
