# Playlist regression test bed

Run from the repository root. Tests use synthetic catalogs and do not need live
YouTube credentials or consume quota.

| Command | What it runs |
| --- | --- |
| `npm run test:all` | Lint, four source type projects plus both test projects, Jest coverage gates, and Chromium |
| `npm run check` | The same checks without Chromium |
| `npm test` / `npm run test:ci` | Jest processing, controller, storage, and Express tests |
| `npm run test:watch` | Jest watch mode |
| `npm run test:coverage` | Jest plus terminal, HTML, LCOV, and JSON reports |
| `npm run test:browser:install` | One-time Chromium download into node_modules cache |
| `npm run test:browser` | Build an isolated in-memory bundle and run Playwright |
| `npm run test:types` | Type-check Jest tests |
| `npm run test:browser:types` | Type-check browser tests and Playwright config |
| `npm run lint` / `npm run lint:fix` | Check/fix TS and TSX source/tests |
| `npm run build` then `npm run test:start` | Production build and built-entry HTTP smoke |
| `npm run test:build` | Disposable builds/watchers; sibling output, cache and environment preservation; forbidden imports and failure propagation |
| `npm run test:client` | Chromium against the actual built Express/client, with fixture-only APIs and a temporary server cache |
| `npm run test:runtime` | Built-code interop: real Axios/cookies, YouTube SDK, native SQLite against loopback fixtures |
| `npm run bench:cache` | Original JSON/SQLite prototype comparison |
| `npm run bench:sqlite` | Actual store replacement, reads, metadata, and memory |

The production build uses Node directly in PowerShell, Git Bash, or Linux. `test:start` executes
the `dist/server` Node entry used by `npm start`, from an unrelated working directory, on a temporary port with fixture
environment values and a safely cleaned temporary SQLite database. It checks the
page, bundle, metadata endpoint, and 404 without YouTube or cache refreshes.

`test:client` uses the same temporary built server, then launches Playwright with
`tests/built-client.config.cjs`. Browser actions have a 10-second limit, the test
has a 60-second limit, and the runner has a 120-second limit. Failure screenshots
and traces are retained in `test-results/built-client/`; stage messages identify
progress in CI. The CI step also has a separate three-minute limit, so a stalled
browser smoke cannot consume the entire job timeout.

For a new checkout:

Select Node 24.22.1 / npm 11.19.1 first; see [setup](../README.md).

```sh
npm ci
npm run test:browser:install
npm run test:all
npm run build
npm run test:start
npm run test:client
npm run test:runtime
npm run test:build
npm run bench:sqlite
```

Chromium defaults to `node_modules/.cache/playwright`; an explicit
`PLAYWRIGHT_BROWSERS_PATH` overrides it. Linux CI installation accepts
`-- --with-deps`. The coding-agent Windows sandbox may require normal process
permissions for Playwright to stop its fixture server; that run was verified.

## Test layers

- **Processing/counting:** filtering/naming, Intro/Boss conventions, duplicates,
  pagination, published/unpublished items, malformed fields, repeated tokens,
  empty channels, failure propagation, and no partial counting result.
- **Freshness:** the original 12-hour server policy and compatibility helper
  boundaries. Browser startup now displays saved data regardless of age, then
  revalidates using server metadata.
- **SQLite/API:** real temporary databases, default/explicit channels, query
  validation, freshness, deduplicated refreshes, lease renewal/fencing/recovery,
  SQL write failure/rollback, committed reads during incomplete writes, migration,
  static assets, CORS, and error/404 responses. A child-process kill proves crash
  recovery. Metadata tests verify timestamp/lease checks without catalog reads
  or YouTube and with a read-only connection separate from the writer.
- **Catalog controller:** saved data before slow replies, version comparisons,
  coalesced checks, background refresh, timeouts/cancellation, bounded polling,
  cooldown/retry, channel changes, selection grace periods, and disk/network races.
  The controller has no player dependency.
- **Legacy utilities:** actual JSON/config/lock-file operations use safely cleaned
  temporary directories. HTTP utility tests mock the client; imports cannot run
  its old demo request. The three unsafe source specs were replaced and removed.
- **Browser/player:** Chromium loads the real HTML/CSS and a bundle built with
  shared production esbuild options, held in memory on port 4179. API/Analytics/
  YouTube calls are intercepted. Real IndexedDB tests cover persistence, slow or
  unavailable APIs, denied/corrupt storage, channel scoping, and cross-tab races.
  Selection tests use refreshed names/counts, and pause/buffering-triggered updates
  preserve the player object, position, and call history. Actual YouTube delivery,
  autoplay behavior, and worldwide playback quality still need manual acceptance.

Strict compiler checks run in four source projects and both test projects. The [YouTube compile-only contracts](youtube-types.contract.ts) verify that invalid IDs/events and unchecked REST fields are rejected; see [typing details](../docs/typing.md).

Jest discovers `tests/**/*.test.ts`; Playwright discovers
`browser-tests/**/*.spec.ts`. No test edits the live playlist cache/configuration.

## Reports and limits

The current desktop run has **167 passing Jest tests** in twelve suites and
**69 passing Chromium tests**. Three Jest TODOs remain in legacy utility coverage;
there are no browser fixmes. Pending tests are not passing tests.

Jest coverage covers selected server/cache/processing modules, shared parsing,
and the catalog controller listed in `jest.config.cjs`. Native IndexedDB and DOM
execution are tested in Chromium and are not included in that percentage.
Current scoped coverage: **90.27% statements, 87.12% branches, 86.07% functions,
92.18% lines**. Gates require 80% statements/branches/lines and 65% functions.

HTML coverage: `coverage/index.html`. Browser report:
`playwright-report/index.html`. Failures retain screenshots/traces. Those reports
and `test-results/` are ignored by Git.

Remaining work includes damaged-database recovery beyond transaction guarantees,
legacy JSON editor reset semantics,
Firefox/WebKit, keyboard/mobile acceptance, future React lifecycle/parity,
bounded rendering, and API/browser concurrency and memory budgets.

See [browser data flow](../docs/browser-cache.md), [server cache](../docs/sqlite-cache.md),
and [benchmark methodology](../benchmarks/README.md). The catalog-state baseline
separates metadata timings from full payload reads; neither is deployed HTTP
capacity. Save performance comparisons under controlled desktop conditions.

## CI and lint policy

[The workflow](../.github/workflows/tests.yml) runs clean installation, lint/types,
coverage gates, build/start smoke, disposable build/watch isolation, Chromium, and small prototype/application-store
benchmark checks on Node 24.22.1, including real runtime interop. It uploads reports
and needs no application secrets. Local Node 24 checks pass; the Actions run records Ubuntu validation for each pushed revision.

Lint permits explicit `any`, inferred return types, logging, and vendor field
names, while keeping promise and empty-block checks. Test mocks may be async
without awaiting, and Jest may inspect mocked methods. Unused-variable cleanup
remains separate work. The toolchain migration is complete;
TypeScript stays on supported 6.0.x pending typed-lint support for 7.x.

Browser interception follows [Playwright's API-mocking approach](https://playwright.dev/docs/mock).

See [separate build outputs, source boundaries, and watcher verification](../docs/builds.md). The React client is now mounted at `/react` and `/react/`; route/reload tests pass. Shared catalog/player integration is implemented; real-media/manual acceptance and remote CI/host validation are next. See [mounted preview](../docs/react-client.md).

React routing tests cover HTML/HEAD, scoped assets, private/missing files, unknown nested paths, unchanged root API paths and missing-build 503s. The built-app Chromium smoke complements the in-memory browser fixtures and is included in CI.

React playback/cache integration is exercised in Chromium, including StrictMode teardown/remount, late API/player callbacks, API/readiness failure, stale/fresh selection, cross-UI tab updates, offline/retry states, keyboard/mobile layout and bounded 100K-catalog rendering. The built-Express smoke verifies mocked playback and a catalog update without another player call. See [implementation and sample limits](../docs/react-client.md).
