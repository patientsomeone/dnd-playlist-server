# Dependency upgrade record

Validated October 29, 2026, locally on `react-prep`. No commits, pushes, global Node selection, or DigitalOcean settings were changed.

## Selected versions

| Area | Before | Tested selection |
| --- | --- | --- |
| Node / npm | 20.18.3 / 10.8.2 | 24.22.1 / 11.19.1 |
| Express / types | 4.21.2 / 4.x | 5.3.0 / 5.0.6 |
| React / React DOM | 18.3.1 | 19.3.1, with matching 19.x types |
| Google SDK | googleapis 117.0.0 | Official `@googleapis/youtube` 40.0.2 |
| SQLite driver | sqlite3 5.1.7 | sqlite3 6.0.1; bundled SQLite 3.52.0 |
| Axios / cookie wrapper / tough-cookie | 1.7.9 / 5.0.5 / 5.1.1 | 1.21.0 / 7.0.0 / 6.0.2 |
| dotenv | 16.4.7 | 18.0.9 |
| TypeScript | 5.4.5 | 6.0.3, restricted to 6.0.x |
| ESLint / typescript-eslint | 8.57.1 / 5.62.0 | 10.13.0 / 8.72.1 |
| Jest / ts-jest | 29.7.0 / 29.2.6 | 30.5.2 / 29.4.15 |
| esbuild / concurrently | 0.27.3 / 8.2.2 | 0.28.2 / 10.0.6 |
| Node types | 20.17.19 | 24.19.2, matching the runtime major |

Remaining retained direct dependencies and type packages are at their current registry releases. Playwright remains 1.64.1. `npm outdated` now lists only the intentional Node-types and TypeScript major holds. Exact installed versions are reproducible through `package-lock.json`.

The current typescript-eslint support range is TypeScript `>=4.8.4 <6.1.0`; ts-jest 29.4.15 supports Jest 29/30 and TypeScript `<7`. TypeScript 7.0.2 is intentionally deferred rather than bypassing peers. [Typed-lint support](https://typescript-eslint.io/users/dependency-versions/).

Node is pinned in `.nvmrc`, engines, VS Code and CI. npm is recorded in engines/packageManager; `.npmrc` rejects unsupported installs, and build/dev/start/check commands give an explicit runtime error. The validation used a checksum-verified, ignored local Node distribution without switching global NVM. DigitalOcean's Ubuntu-22 runtime lists the chosen Node version; the actual next host build still needs verification. [Host runtime reference](https://docs.digitalocean.com/products/app-platform/reference/buildpacks/nodejs/).

## Compatibility work

- Express 5 uses `/{*unmatched}` for the final GET 404 route. Explicit `extended` query parsing preserves rejection of nested/array channel inputs; the existing controlled error contracts remain covered.
- Google recommends standalone API packages to reduce startup overhead. The all-APIs package pulled roughly 1.8 GB into the updated compiler process; the app now imports only the official YouTube SDK, with updated mocks and a real loopback request/error check. [Google SDK installation](https://github.com/googleapis/google-api-nodejs-client#installation).
- React 19 return types use `React.JSX`. Hooks checks found the prototype data effect's missing dependency; its loader now cancels stale work and receives the stable state setter. It remains a prototype, not the new `/react` client.
- Axios and the ESM cookie wrapper interoperate through Node 24's CommonJS support. A narrow type assertion bridges their separate ESM/CJS Axios declarations; real loopback tests verify cookie persistence and HTTP errors.
- TypeScript 6 source roots are explicit; the previous non-strict policy is explicit too. Jest uses NodeNext with isolated transforms and an ES2022 test target. ESLint is now flat config, with maintained stylistic rules and React Hooks checks. Intentional `any` and existing promise checks remain allowed/enabled respectively; obsolete TSLint config was removed.
- Build and browser watch now use Node/esbuild directly. Gulp, gulp-cli, gulp-prompt and opn, their old Git workflow, and the script that could push `master` after compilation failure were retired. The production build compiles then bundles once and propagates failures. Dev still performs a build followed by the watcher's initial rebuild; further startup simplification belongs with client isolation.
- Environment loading is centralized: host variables, then root `.i.env`, then optional `.env`, without overwriting existing values or printing dotenv banners. README and package metadata now describe this app.

## Security reports

| Scope | Before low / moderate / high / critical | After low / moderate / high / critical |
| --- | --- | --- |
| Full install | 15 / 9 / 21 / 4 (49 entries) | 6 / 0 / 0 / 0 (6 entries) |
| Dev dependencies omitted | 2 / 6 / 14 / 3 (25 entries) | 0 / 0 / 0 / 0 |

These are npm affected-package entries, including transitive/install tooling, not confirmed exploitable application paths. Fresh `npm audit --json`, `npm audit --omit=dev --json`, and `npm outdated --json --prefer-online` reports are saved locally in `.i.audit-after-all.json`, `.i.audit-after-runtime.json`, and `.i.outdated-after.json`. The pre-upgrade reports are retained separately.

The six remaining low entries are one `deepmerge` advisory propagated through Jest/Jest config/ts-jest. The advisory lists **no patched version**. The affected merge is used by the local test configuration; player/API requests do not supply Jest configuration. npm proposes downgrading Jest to 25.1.0; that incompatible downgrade was not applied. Track upstream fixes and re-audit rather than hiding the finding. [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

`sqlite3`'s upstream was archived July 1, 2026. Version 6.0.1 is an official release with matching Windows/Linux native assets, and the current driver passes the cache suite, but a maintained-driver plan remains follow-up work. Install output also reports upstream deprecated transitive packages (`prebuild-install`, `node-domexception`, and Jest's glob). No unreviewed overrides were added. npm's installer allowlist explicitly allows SQLite and esbuild; optional watcher/resolver installer scripts remain unapproved, and their installed prebuilt paths passed local checks. [SQLite upstream releases](https://github.com/TryGhost/node-sqlite3/releases).

## Verification and performance

- Isolated clean `npm ci`, with native lifecycle installation, followed by the real runtime interop smoke.
- Zero lint errors/warnings and passing source/Jest/browser type checks.
- 139 passing Jest tests in nine suites, four existing TODOs, unchanged coverage gates; 23 passing Chromium tests.
- Production build directly in PowerShell, built-entry startup/HTTP smoke, and real loopback Axios cookies/errors, YouTube SDK requests/errors, and SQLite loading.
- A copy of the existing database read and transactionally replaced all 72 playlists, including metadata reads; source files were hash-checked unchanged.
- Separate desktop benchmark at 1K/10K/100K using Node 24 / SQLite 6. The first run overlapped installation and was discarded from the saved baseline; the replacement run ran alone.

At 100K lists, the [saved upgrade baseline](../benchmarks/results/dependency-upgrade-baseline.json) measured 1,046 ms replacement, 477 ms full-read/serialization p50, and 0.148 ms metadata p50. The previous baseline measured 1,206 ms / 566 ms / 0.135 ms. Process maximum RSS rose from 343 to 398 MiB. These are observations from two desktop runs, not isolated attribution to a particular package or deployed HTTP capacity. Keep the memory increase visible in future load work; the 127-byte metadata response remains independent of catalog size.

CI now selects Node 24.22.1 and includes the runtime smoke. Remote Linux CI, actual host runtime selection/replacement, and real YouTube/manual media acceptance remain unverified. The runtime smoke uses loopback fixtures, so no live API quota was consumed.

## Subsequent strict-typing pass

Strict mode is now enabled across source and both test projects; the non-strict setting above describes the initial upgrade stage. Published declarations were added for async, atob, btoa, JSONStream, and edit-json-file. The player uses real YT types, REST data is guarded/normalized, and compile-only negative checks detect regressions to any. All checks pass with 147 Jest tests (three TODOs), 23 Chromium tests, and production build/start/runtime smoke. See [strict typing and YouTube](typing.md). Next: separate server/client builds, then mount `/react`.

## Subsequent build separation

Independent server, legacy and React builds now use strict platform-specific projects, safe shared models, isolated output directories and scoped watchers. The dev runner replaced concurrently (17 installed packages removed). The production entry is `dist/server/routes/app.js`; root-based environment/static/cache lookup survives relocation. Disposable real-build/watch checks and the full suite pass; see [build layout](builds.md). Next: mount `/react`.

## Subsequent React route mounting

The preview is mounted at `/react` and `/react/`, with assets isolated under `/react/assets` and the legacy root/API preserved. Validation now includes 161 Jest tests, 26 Chromium cases and a real built-Express Chromium smoke with fixture-only APIs. The prototype still needs the shared catalog service and player parity; see [mounted preview](react-client.md). No deployment was performed.

## Subsequent React catalog/player integration

The prototype loader was replaced by the shared catalog/IndexedDB hook, and the typed private player lifecycle is implemented without importing the legacy entry or adding runtime dependencies. A precise CSS asset declaration supports the scoped client stylesheet. Validation: 161 Jest tests / 45 Chromium cases, production playback smoke with a fake IFrame API, strict/lint checks and build/watch isolation. A separate 100K-catalog browser sample is saved; see [React implementation and remaining acceptance](react-client.md). No deployment or legacy-root cutover was performed.
