# Browser catalog cache and background revalidation

SQLite is the shared server cache. IndexedDB stores each browser's downloaded
catalog so the page can show its last usable data without waiting for the server.
JSON remains the HTTP transport format; browser persistence is now structured
IndexedDB records.

## Flow

1. Start the IndexedDB read and `/cacheState` check concurrently. Display saved
   data as soon as it is available, regardless of age.
2. Before deciding a full payload is needed, allow a pending local read up to
   100 ms to finish. A slow local database cannot indefinitely delay server data.
3. Download `/listCount?channelId=...` only when the server has a newer catalog,
   or when this browser has no catalog for that channel.
4. Start a background refresh if server data is expired and no owner is working.
   While an owner is working, poll only metadata.
5. Persist/render complete new catalogs as they arrive. Music keeps playing.

A late local snapshot cannot overwrite a newer in-memory catalog or a newly
resolved channel. If the server check fails before saved data arrives, the saved
catalog still restores offline browsing when its read completes.

The original **12-hour** server policy still determines when to re-check YouTube.
An IndexedDB snapshot newer than an old server seed is retained until the server
publishes a newer version. Default-channel changes clear the old catalog before
loading the new channel; explicit channel requests reject mismatched replies.

Selections, player-ready/state/error/playback-rate callbacks, interactions on the
parent player panel, focus/visibility/reconnect events, and cross-tab notices can
request revalidation. Concurrent checks are coalesced. BroadcastChannel notices
contain a channel ID and trigger a server check; they do not synchronize playback.

Selection gives a freshness check up to 1.5 seconds. React displays a brief
message below the list; legacy waits silently when a usable catalog exists.
Slow checks continue in the background while saved data stays
usable. A queued selection checks again when the player becomes ready, then uses
the latest name/count for that playlist ID. Rapid clicks keep the latest choice.
If the ID disappeared, playback is left alone and the user can choose again.

## Player isolation

`CatalogSync` owns no player and issues no playback commands. Rendering touches
only the playlist list, timestamp, and catalog status/retry controls. It does not
replace the iframe, change the playback heading, seek, pause, stop, or load a
playlist. Only explicit selection calls the player-loading function. YouTube
state callbacks retain their usual heading and initial shuffle/loop behavior.

Names render as text; links use encoded YouTube playlist IDs. Metadata is
separated before sorting, including labels after the former `lastUpdate` key.

## `/cacheState`

The endpoint accepts the same default/explicit channel query as `/listCount`.
It returns `Cache-Control: no-store` and fields `channelId`, `lastUpdate`,
`hasCache`, `locked`, `fresh`, and `serverTime`. A missing timestamp is null.
`locked` means an unexpired SQLite refresh lease, not a `.lock` file.

A separate read-only WAL connection reads indexed channel/lease metadata without
scanning playlist rows or joining the writer's replacement queue. It does not
import JSON or contact YouTube. Leases still deduplicate imports and protect
commit ownership.

The [desktop benchmark](../benchmarks/results/catalog-state-baseline.json)
measured a 0.135 ms warm metadata read/serialization p50 at 100K playlists and a
127-byte synthetic response. The probe during replacement took 1.107 ms while
replacement took 1,206 ms. These are storage timings, separate from HTTP/network
latency. Full catalogs still need paging/bounded rendering before a large rollout.

## IndexedDB and failures

Database `dnd-playlist-cache`, version 1, object store `catalogs`, keyed by `scope`.
The default uses `default`; an explicit channel uses `channel:<channelId>`.
Records contain canonical channel ID, timestamp, and playlists, without player
state or credentials.

One read/write transaction prevents an older in-flight response from replacing
newer data saved by another tab. Completion is reported after the transaction
commits. Connections close on version changes. Blocked/unavailable/quota-failed
storage falls back to memory, and invalid records are replaced with valid data.
Failed opens are cleared rather than retained as a rejected promise. Saving a
downloaded snapshot retries an open failure once, so a transient startup failure
does not disable persistence for the rest of the page. Transaction/quota failures
still use the in-memory fallback.
See [IndexedDB transaction completion](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

Failed updates retain the usable catalog. React shows update feedback below the
list; legacy keeps routine checks, refreshing, and cached/offline fallback silent.
Without saved data, an accessible error and Retry button appear. Metadata/catalog requests have a
five-second timeout; refresh requests have 30 seconds, including body parsing.
Disposal aborts client requests; an existing server import can finish for others.
Polling stops after 40 checks at three-second intervals. Failed refreshes have a
30-second cooldown; manual Retry/reconnect can restart checking.

The page/assets still load normally: no service-worker/offline application shell
was added. `npm run test:all` tests the controller and shared contracts in Jest,
then real IndexedDB, the legacy bundle, and player isolation in Chromium. Actual
YouTube media delivery remains a manual acceptance check.

## React integration

The React hook now wraps these same catalog/storage classes, including cross-UI tab notifications and scoped channel records. A private player controller receives only explicit selections and metadata-check callbacks; background data changes cannot load/seek/replace it. Native browser tests cover React startup, failures, unmount/remount, stale selection and active playback. See [React catalog/player lifecycle](react-client.md).
