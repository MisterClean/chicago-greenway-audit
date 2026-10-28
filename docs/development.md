# Development

The active application is a static, route-based map. It reads the committed route and evidence assets in `public/routes/`; the legacy Rust solver and its inventory publication format are retained separately. The route data describes source-inferred movements, not field-verified permissions or a completed cycling-stress audit.

## Quickstart

Use Node.js 24 or newer and npm. A normal development build uses the committed assets; it does not need Rust, Osmium, the ignored OSM extract or the staging database.

```sh
npm ci
npm run verify
npm run dev
```

Open the URL printed by Vite. For the production build, run `npm run build`, then `npm run preview` and open the printed local URL. The map uses MapLibre and a network-hosted CARTO basemap; route assets are static and need no routing server or API key. `npm run build` checks evidence and coverage freshness, prepares static tile chunks from the committed PMTiles, type-checks, and writes `dist/`.

`npm run verify` runs the JavaScript/TypeScript tests, validates the committed route export, and builds the application. It does not run the legacy Rust tests or the source-dependent route audit. Passing checks establish internal consistency, not current signage, ground conditions or field approval. Browser and device checks remain separate.

## Commands

| Command | Role | Requirements and effects |
| --- | --- | --- |
| `npm run dev` | Active app development | Runs Vite locally using existing public assets. |
| `npm run preview` | Active app preview | Serves the production `dist/`; run `npm run build` first. |
| `npm test` | Active automated tests | Runs `web/src/*.test.ts` and `scripts/*.test.mjs`. |
| `npm run verify` | Active default check | Tests, `verify:routes`, then `build`; no Cargo requirement. |
| `npm run verify:routes` | Active export check | Validates `public/routes/pilot.json` geometry, lengths, runs and movement consistency. |
| `npm run build` | Active production build | Checks catalog and coverage, prepares tile chunks, type-checks and builds Vite. |
| `npm run data:routes` | Active route regeneration | Requires saved city data and staged SQLite; rewrites route, catalog and coverage outputs. |
| `npm run audit:routes` | Active source audit | Requires the staged SQLite database and saved snapshots; compares sampled and targeted results against sources. |
| `npm run data:evidence`, `npm run verify:evidence` | Active evidence workflow | Rebuilds or checks both derived evidence catalogs and the byte-exact public review copy from editable review evidence. |
| `npm run data:coverage`, `npm run verify:coverage` | Active inventory workflow | Rebuilds or checks coverage derived from city rows and the route export. |
| `npm run network:stage` | Source preparation | Requires Osmium and the exact PBF; recreates staged tables and rewrites the OSM source manifest. |
| `npm run data:snapshot` | Source acquisition | Fetches current city responses and overwrites the default source files and manifest; this is not historical reproduction. |
| `npm run verify:legacy` | Legacy full check | Preserves the former sequence: tests, Cargo solver tests, and app build. Requires Rust/Cargo. |
| `npm run fixtures` | Legacy solver fixtures | Runs the Rust solver against fixture inputs; requires Rust/Cargo. |
| `npm run data:build` | Legacy publication pipeline | Builds the older normalized inventory/publishing format; see [data contract](data-contract.md) for reviewed-bundle inputs and prerequisites. |
| `npm run network:review`, `npm run data:verify` | Legacy inventory workflow | Candidate review and legacy publication-asset checks, respectively; these are not the active route audit. |

Some legacy publication tasks require the raw source snapshots and external tools, including Tippecanoe. The legacy scoring output is not the active map's vehicle-continuity calculation.

## Rebuilding the route data

The saved city extract is `data/sources/greenways.json`, with SHA-256 `b26466b5e898bdd32732df9484a5bf5fe59eed4edf2d3e27a6c2fdf07c44dda2`; its manifest records retrieval on September 19, 2026. It is a `Neighborhood Greenway`-filtered extract, not a complete bicycle network. The OSM extract is `data/sources/Chicago.osm.pbf`, effective September 11, 2026, SHA-256 `f24bf47c661b461bc817e4be127bb1726c82c014054df1f9bc39b1fe8b1c3f8c`. Check the manifests in `data/sources/sources.json` and `data/sources/osm-source.json` for provenance and licensing. The PBF is large and ignored by Git, as is `data/staging/`; a changing download URL does not guarantee the saved historical bytes. Obtain the exact extract and verify its hash before staging. The city snapshot and committed public route assets are retained in the repository.

With the exact PBF and Osmium 1.19 or newer installed, create the SQLite stage if absent, then regenerate and validate:

```sh
npm run network:stage
SOURCE_DATE_EPOCH=1793091600 npm run data:routes
npm run verify:routes
npm run audit:routes
npm run verify
```

`network:stage` clears and repopulates its database tables and rewrites `data/sources/osm-source.json`, including its retrieval metadata. Review the resulting manifest diff rather than assuming staging is read-only. `SOURCE_DATE_EPOCH` fixes the audited export's generation timestamp; changed inputs, dependencies or source evidence can still change the output. The independent sample in `data/routes/pilot-validation.json` is tied to an output hash, so refresh and inspect it when an intended export changes. Verify generated diffs and source fingerprints before committing.

## Refreshing snapshots

A new city or OSM download is a new analysis input, not a reproduction of the saved audit. Reconcile changes to exact city IDs, route scope, source topology and the evidence bindings before publishing. Rebuild the SQLite stage for a changed PBF and inspect the source-dependent audit. The route builder currently carries explicit `osm_date` and `designation_date` display literals; update those to the verified effective dates when replacing inputs. Retrieval dates are not installation dates. Review the coverage metadata and source notes as well as the displayed dates; passing a hash check alone does not establish that the snapshots agree.

## Evidence and contributions

`data/routes/pilots.json` selects source rows and records explicit aliases, route joins and reviewed matching exceptions. `data/routes/review-evidence.json` is the editable evidence input; generated catalogs in `data/routes/` and `public/routes/` are derived from it. Bind a claim to the relevant city rows and mapped ways or ordered node slices, and record source URL, scope, date meaning, status, review method, and a hash of the exact saved document or extract when available. Keep missing information and failed searches visible. A proposal, a reported installation, a historical snapshot and a current field observation have different evidentiary weight; city designation alone does not establish motor access. See [evidence catalog](evidence-catalog.md) for the schema and fingerprint semantics.

For metadata-only changes that do not affect the route export, run `npm run data:evidence` followed by `npm run verify:evidence`; this synchronizes both catalogs and the byte-exact public review copy. Changes to evidence URLs, reasons, scope, matching, movement inference or other fields consumed by route generation require `npm run data:routes` with the staged source, followed by `npm run verify:routes` and `npm run audit:routes`; inspect generated diffs and the output-hash-bound audit sample, then run `npm run verify`. Route audits and catalog validation check the data and implementation; they do not independently authenticate every source or replace field review. Check any links and source documents relevant to the claim, and preserve uncertainty where permissions or geometry remain unresolved.

Route IDs are component identifiers, not authoritative project IDs. `scripts/component-route-ids.mjs` supports explicit city-row anchors in configuration to preserve an existing component ID through a scope change; unanchored components use their order. Anchors must be unique, belong to the component and avoid collisions. Adding, splitting, joining or reordering components can change unanchored IDs, and anchored IDs do not imply that project boundaries, motor movements or share links remain semantically unchanged. Review ID and link effects when changing component scope.
