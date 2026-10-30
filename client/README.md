# React player

Run `npm run build:client` from the repository root; one root npm install supplies the browser application. Express serves `dist/client` at `/react` and `/react/`, with assets scoped to `/react/assets`. The legacy player remains at `/`.

React uses the shared catalog/IndexedDB service through `hooks/useCatalog.ts`. A private `PlaylistPlayer` controller owns the IFrame player; catalog updates cannot reload or seek it. Search and 100-row pages bound DOM rendering.

See [implementation, test coverage, benchmark and manual acceptance](../docs/react-client.md), and [build/type boundaries](../docs/builds.md). Server modules and cached JSON cannot be imported into the browser build.
