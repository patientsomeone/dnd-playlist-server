# Playlist organizer direction

The immediate product goal is quick, low-distraction selection of alphabetically
organized music during a worldwide D&D session over Discord. Keep familiar labels
such as `Travel/Campfire` easy to find. The React trial should preserve that
workflow before adding the later multi-DM and synchronized-playback features.

## Catalog caching: implemented policy

- Cache age is measured from the last successful catalog update, not the last
  visitor or player action.
- Preserve the original coded 12-hour interval. The owner's earlier two-day
  recollection was not a requested behavior change; existing code is the source
  of truth.
- The server refreshes at exactly 12 hours. The browser now displays saved data
  regardless of age and uses `/cacheState` for background revalidation. The old
  inclusive helper mode remains covered for compatibility; startup is no longer
  gated on a browser freshness check.
- The server and legacy browser share the browser-safe policy in
  `src/shared/playlistCachePolicy.ts`. Esbuild watches this shared source as well as
  the legacy browser entry.
- Missing/invalid timestamps require a refresh. A successful refresh sets the
  update timestamp. Playback commands do not constitute catalog refreshes.
- The [SQLite cache](sqlite-cache.md) now preserves previous catalogs on refresh
  failure, commits complete snapshots, and deduplicates refreshes with expiring
  owner-tagged leases. The [browser cache](browser-cache.md) now supports stale
  data, bounded metadata polling, retry/error states, and request cancellation
  without issuing player commands.

## Future DM configuration: planned, not implemented

- A DM view associates an account, its configured channels, and its supplied
  YouTube API credential. Metadata refresh jobs use the credential configured for
  that DM; player browsers never receive that secret.
- Credential storage, replacement, and removal belong on the server, behind DM
  authentication. An API key identifies a Google Cloud project; it does not
  authenticate a DM to this application.
- Track quota usage by the supplying project/DM, with appropriate import bounds
  and service-wide concurrency limits. Keys belonging to the same Google Cloud
  project share its quota; adding a key is not itself a new quota allowance.
  [YouTube credentials](https://developers.google.com/youtube/registering_an_application)
- Public channel metadata may be reused across subscriptions. Account ownership,
  room permissions, and any future private data must remain correctly scoped.
- User accounts and saved settings require durable storage before launch. The
  [current DigitalOcean deployment](deployment.md) has no database declared.

## Optional follow-DM playback: confirmed direction, not implemented

Each game session has its own room. A player explicitly joins follow mode and
can opt out to independent playback, then rejoin the room's current position.
Local volume/mute stays local. Only authorized DM controls update room playback.

The proposed realtime channel carries a small authoritative snapshot:

- room and controller identity;
- selected playlist and actual video identity;
- playing/paused state, playback rate, and reference position;
- server timestamp and an increasing state revision.

Followers estimate the current target position from that snapshot and correct
meaningful drift. Late joins and reconnects receive the latest snapshot. Ignore
stale/out-of-order updates and prevent follower player events from feeding back
as new DM commands.

The DM determines actual video progression/shuffle order. Followers must not
independently randomize the playlist, because identical playlist selections can
otherwise produce different videos on different browsers. Keep existing Boss
start-at-zero/no-shuffle behavior when the DM controls the playlist.

Playback messages use the room channel, not the catalog-refresh endpoint. Each
browser plays its own YouTube embed; audio/video is not relayed through Express.
WebSockets are a candidate transport, to be chosen and tested during that phase.

Treat synchronization as best-effort alignment, not sample-accurate audio.
Buffering, ads, availability differences, and browser autoplay restrictions can
interrupt individual players. Show join/retry/resync states and let players opt
out. The YouTube player API exposes playback controls and autoplay-blocked events:
[IFrame API](https://developers.google.com/youtube/iframe_api_reference).

Test with fake players and simulated latency, clock skew, disconnects, stale
updates, DM track changes, and independently muted/opted-out participants before
manual international browser sessions. Include room isolation and bounded fan-out
in the [performance plan](../benchmarks/README.md). These are planned extensions
after legacy/React playback parity, not an account/realtime implementation added
to the current cleanup.
