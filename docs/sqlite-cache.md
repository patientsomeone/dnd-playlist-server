# Server-side SQLite cache

The active `/listCount` and `/refreshPlaylists` pipeline now uses SQLite.
The default database is `data/playlist-cache.sqlite` under the repository root,
outside `public` and `dist`. Set `PLAYLIST_CACHE_DB_PATH` to override it;
relative overrides resolve from the process working directory. The directory
is created automatically. SQLite and its native driver are runtime dependencies.

The API retains the existing named-playlist object plus `lastUpdate`, and the
`{status: "processing"}` response. The original 12-hour freshness policy remains
unchanged, including the browser/server boundary distinction.

## Historical renamed-playlist duplicates

The old JSON catalog path constructed `jsonUtils` before resetting the file.
Its `edit-json-file` editor eagerly loaded the old data; `resetPath()` recreated
the disk file but kept that editor instance. Later autosaved `set()` calls wrote
the old in-memory keys back alongside the renamed playlist. A synthetic reset
and rename reproduces both `City / Downtime` and `City` with the same ID, even
though the file was cleared before writing the new entry.

The active legacy and React pages now share complete transactional SQLite
replacement, ID normalization on cache reads/writes and browser-cache parsing,
plus a final ID guard in each renderer. Legacy regression tests cover aliases
from server and offline IndexedDB records, preserving focus/playback through a
rename, current selection metadata, and reload persistence. The built-app smoke
also seeds duplicate IndexedDB aliases before exercising the actual legacy bundle.
The generic JSON utility's remaining reset TODO concerns the old helper; the
active catalog pipeline no longer uses it.

## Refresh and transaction behavior

The server fetches every playlist page and counts published playlist items in
memory first. It then replaces that channel's rows and timestamp in one SQLite
transaction. Failed requests or writes do not publish a partially rebuilt cache.
Counting no longer resets storage or mutates its input playlists.

`cache_channels` holds timestamps; `cached_playlists` holds names, YouTube IDs,
links, and counts. The channel/name primary key preserves current duplicate-label
behavior and indexes channel reads; a channel/playlist-ID index supports later
lookup work. Each read obtains metadata and rows with one SELECT so they belong
to the same committed snapshot. Writer/catalog operations are queued to prevent
asynchronous transactions from interleaving. `/cacheState` uses a separate
read-only WAL connection to avoid the writer's replacement queue.

Catalogs are normalized to one entry per YouTube ID on processing, replacement
and reads, including legacy imports and older databases containing renamed aliases.
Without per-row rename timestamps, the first alphabetical label wins together
with its own link/count; counts are not merged and freshness is unchanged.
Existing physical alias rows need no destructive migration: reads normalize them,
and the next successful refresh writes the current complete snapshot.

SQLite uses WAL, full synchronous commits, foreign keys, and a five-second busy
timeout. Other connections see committed snapshots during a write. See
[SQLite transaction isolation](https://sqlite.org/isolation.html) and
[write-ahead logging](https://sqlite.org/wal.html).

## Refresh ownership and recovery

Old `.lock` files are no longer consulted or written. SQLite's `refresh_leases`
table provides atomic per-channel acquisition and a random owner token.
Concurrent refresh requests receive `processing`; channel reads can still return
the previous complete catalog. A second freshness check after acquisition avoids
duplicate work when another refresh just completed.

Leases last **60 seconds** and renew every **20 seconds** during active work.
Normal completion and failures release the owner's lease in `finally`.
A killed process cannot renew: another process can reclaim its expired lease.
Only the current, unexpired owner may commit, and releasing an old token cannot
delete a successor's lease. Ownership is checked inside the write transaction
before replacement and again before commit.

YouTube requests have a 30-second per-request timeout. Repeated page tokens
are rejected instead of causing an infinite scan. Deployment-wide concurrency,
catalog/import bounds, credentials per DM, and broader quota controls remain
future work.

The browser renders a saved IndexedDB catalog immediately and checks `/cacheState`.
It polls metadata while a refresh is running. Catalog updates, errors/retry, and
request cancellation are separate from playback; see [browser cache flow](browser-cache.md).

## Existing JSON and cold starts

When a channel has no SQLite entry, a valid `public/json/<channelId>.json` is
imported on its first read, preserving its timestamp. The import is transactional
and cannot overwrite a channel another request has already populated. Original
JSON files remain unchanged for rollback/reference; subsequent refreshes update
only SQLite. Invalid/missing JSON is treated as a cache miss.

The unattributed `public/json/listCount.json` seed is deliberately not assigned
to arbitrary channels. If the matching channel file is absent on a new deployment,
`/listCount` returns `{}` and the normal browser flow starts a YouTube refresh.
Old prototype React data loading now uses `/listCount` too.

Invalid scalar/array/object query values return JSON 400 errors. Cache read
failures return JSON 500 errors; refresh failures return JSON 502 errors without
upstream details or credentials. Unknown routes retain their existing 404.

SQLite files and their WAL/SHM sidecars are ignored by Git. The database is a
server-local, rebuildable cache. The current DigitalOcean App Platform deployment
still has ephemeral storage; this change adds no persistent volume or managed
database. Accounts and saved user settings need durable storage before launch.
See [deployment settings](deployment.md).

## Verification and performance

Tests use real temporary SQLite databases with mocked YouTube. They cover atomic
replacement, SQL-triggered write failure/rollback, old snapshots during writes,
competing connections, token fencing, renewal/failure cleanup, JSON migration,
and an actual child-process kill during an uncommitted write. Existing browser
tests preserve playback behavior and verify repeated processing responses.

```sh
npm run test:all
npm run build
npm run test:start
npm run bench:sqlite
```

The new benchmark exercises the compiled application store, including transactional
replacement, full reads/serialization, four queued read calls, payload bytes, RSS
before/after, and process-lifetime maximum RSS. It verifies output equivalence
and channel isolation. It uses synthetic data in a temporary database, not live
YouTube or the real cache. It does not measure HTTP concurrency or browser rendering.

The saved [desktop baseline](../benchmarks/results/sqlite-store-baseline.json)
has 1K/10K/100K catalogs. For 100K playlists: replacement took 1,271 ms, full
read/serialization p50 was 587 ms, and four queued reads took 2,449 ms. The
response was 10,369,808 bytes; process maximum RSS reached about 344 MiB.
These fixtures differ from the older prototype benchmark, so the timings are
not a direct before/after comparison. Bounded API queries and browser rendering
remain necessary before a large-catalog rollout.

No deployment, commit, or push is performed by this migration.
