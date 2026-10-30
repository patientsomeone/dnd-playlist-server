# Cache performance baseline

```sh
npm run bench:cache
npm run bench:cache -- --output=benchmarks/results/cache-baseline.json
npm run bench:cache -- --sizes=1000 --samples=5
```

This compares prototype JSON and SQLite cache operations using synthetic data at
1,000, 10,000, and 100,000 total playlists. The existing `sqlite3` development
driver is used. This original benchmark remains a storage prototype comparison;
the application has since migrated to SQLite as described below.

Each size runs with one DM and with 100 DMs. JSON uses a separate file per DM,
matching the current channel-based design. SQLite uses one database with indexed
channel/name and channel/playlist ID columns. Each operation returns the same
data shape and is checked for equivalent results before measurements are saved.

Measured operations include reading a whole channel, returning its first 100
playlists, returning its last 100 using offset pagination, and looking up one
playlist. Timings include file/query access, parsing/materialization, and JSON
response serialization. Reports include p50/p95/max latency and response bytes.
Database initialization is reported separately and excluded from read timings.

These are serial **warm-read storage measurements on the machine running the
command**. They do not predict DigitalOcean latency, concurrent request capacity,
peak memory, cold starts, refresh/write throughput, YouTube quota use, or browser
rendering time. Synthetic data has unique labels and a simple schema. Explicit
garbage collection, when available, happens outside the timed operations. Fifteen
samples give an initial comparison, not a statistically robust capacity limit.

The developer's desktop is the agreed baseline for ongoing performance testing.
Run comparable datasets and workloads there, recording hardware/runtime details,
latency, memory, and concurrency so changes can be compared consistently. Matching
the current hosting container's limits is not a prerequisite for this work.

The current DigitalOcean deployment is one 1-vCPU/0.5-GB App Platform instance;
see [deployment settings](../docs/deployment.md). Revisit hosting size and validate
the selected tier when preparing a larger rollout. Desktop measurements describe
the tested environment rather than guaranteeing capacity on another machine.

Fixtures/databases live in a unique temporary directory and are removed when the
run finishes. The benchmark does not read credentials, contact YouTube, modify
the live cache, or load-test the hosted site. Stop a run with Ctrl+C if needed;
an interrupted process can leave its uniquely named temporary directory behind.

## Performance work to add as the application evolves

- [ ] **Measure API and tenant scaling**
  - Use 1K/10K/100K datasets, both one huge DM and many smaller DMs. Record p50,
    p95, error rates, throughput, payload size, memory, and event-loop delay for
    bounded concurrent requests. Verify tenant isolation under every workload.
- [ ] **Measure refresh and write contention**
  - Compare whole-channel refreshes, incremental updates, simultaneous readers,
    competing refreshes, lock recovery, and failed writes. Use mocks for YouTube.
- [ ] **Keep browser work bounded**
  - Test page sizes, searching, sorting, React rendering, scrolling, and playlist
    selection against large synthetic catalogs. Add pagination/virtualization
    before asking the browser to display 100,000 entries at once.
- [ ] **Set and enforce performance budgets**
  - Establish desktop regression budgets, save comparable baselines with runtime
    and hardware details, and add opt-in/CI checks on controlled hardware.
    Revisit DigitalOcean sizing when planning a larger deployment.
- [ ] **Bound refresh costs and abusive inputs**
  - Set per-account/channel import limits, page/batch limits, timeouts, refresh
    cooldowns, concurrency limits, and a global YouTube quota budget. Deduplicate
    refreshes and paginate results rather than allowing unbounded fan-out.
- [ ] **Test restart and deployment behavior**
  - Recreate the application instance and verify cache rebuilding and recovery.
    Persistent user/account data requires durable storage before accounts launch.

SQLite provides indexed queries and transactions, but it does not automatically
bound API responses or browser rendering. Its single-writer behavior and the
deployment's persistence model must be measured and designed for separately.

## First local result

The initial Windows/Node 20 run is saved in
[`results/cache-baseline.json`](results/cache-baseline.json). For one DM with
100,000 playlists, these were the median times, including serialization:

| Operation | JSON | SQLite |
| --- | ---: | ---: |
| First 100 playlists | 172.808 ms | 1.007 ms |
| Last 100 using offset pagination | 187.038 ms | 13.532 ms |
| One playlist by label | 144.795 ms | 0.332 ms |
| Entire channel | 219.600 ms | 632.669 ms |

The full response was 13,046,028 bytes with either backend; a first page was
13,020 bytes. Indexed, bounded queries are the main benefit in this workload.
Returning the entire catalog still costs time and memory, and this driver was
slower at materializing all 100,000 rows. Deep offset pagination also grew slower;
compare cursor pagination when the API is designed.

With 100,000 playlists distributed across 100 DMs, the selected DM's JSON file
contained only 1,000 entries. Its first page took 1.576 ms for JSON versus 0.811 ms
for SQLite. This is why the benchmark preserves per-channel JSON files rather
than treating every DM as one giant JSON document. These results are local
prototype measurements, not production capacity or latency guarantees.

## Application SQLite store

After `npm run build`, run `npm run bench:sqlite`. It exercises the actual compiled
cache implementation at 1K/10K/100K playlists, with transactional replacement,
full-channel reads/serialization, four queued calls, payload sizes, and memory
observations. Use `-- --sizes=1000 --samples=3` for a smoke run, or
`-- --output=benchmarks/results/sqlite-store-baseline.json` to save a comparison.

The [first application-store baseline](results/sqlite-store-baseline.json) was
run separately from other validation commands. At 100K, replacement took 1,271 ms,
full-read p50 was 587 ms, and process maximum RSS reached about 344 MiB.
Read [methodology and limits](../docs/sqlite-cache.md#verification-and-performance)
before comparing it with the earlier prototype: fixtures/payload sizes differ,
and queued storage calls are not concurrent HTTP/browser capacity tests.

The [catalog-state baseline](results/catalog-state-baseline.json) adds metadata
read/serialization and a metadata probe during replacement, using the production
read-only connection. At 100K playlists it measured 0.135 ms metadata p50 and
1.107 ms during replacement, with a 127-byte synthetic state response. HTTP and
network overhead are not included; see [browser cache flow](../docs/browser-cache.md).

The [dependency-upgrade baseline](results/dependency-upgrade-baseline.json) uses
Node 24.22.1 / sqlite3 6.0.1, with the same application-store workload run separately
from other checks. At 100K: replacement 1,046 ms, full-read/serialization p50 477 ms,
metadata p50 0.148 ms, metadata during write 0.266 ms. Maximum RSS reached 398 MiB
versus 343 MiB in the prior baseline. This combines runtime/driver changes and
normal desktop variation; it does not isolate their individual effects. Keep the
observed memory increase in future comparisons. See [upgrade limits](../docs/dependency-audit.md).

## React catalog rendering

The browser suite includes a 100K synthetic-catalog scenario with search, 100-row pages and a single catalog payload. It attaches timings to the report. To save a fresh isolated sample, set `REACT_BENCHMARK_OUTPUT` to a path directly under `benchmarks/results` and run only `browser-tests/react-scale.spec.ts` with the browser test command. Keep other validation idle for comparisons.

The [first saved React baseline](results/react-catalog-baseline.json) measured 907 ms to the initial visible rows, 63 ms to change pages and 70 ms to search on the recorded desktop/Node/Chromium environment. These include automation and mocked response delivery, not deployed HTTP/network capacity. They do not measure browser peak memory or establish a regression budget. Full response transfer/parsing still grows with catalog size; API pagination/search is future work.

The current inline search deliberately waits 300 ms after edits before filtering. Its attached `searchMs` includes that debounce, so compare against the original immediate-filter sample with that UI delay in mind. Expanding the search bar is outside the timed search interval.
