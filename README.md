# Chicago Greenway Audit

Rust straight-through driving solver and TypeScript/MapLibre static map, implementing the attached [technical specification](docs/technical-spec.md).

**Current release is a citywide inventory, not a completed driving audit.** Chicago contains 1,452 unique geometry intervals covering 85.23654 designated miles from all 258 official greenway source records. All current scores are deliberately `lb_mm=0, exact=0`. Changing the threshold works, but cannot turn these unresolved records green. Synthetic results are never placed on Chicago streets.

## Run

Requires Node 24+, Rust/Cargo, and Tippecanoe 2.79+ for data builds. Osmium 1.19+ is needed only for raw network staging.

```sh
npm ci
npm run fixtures
npm run verify
npm run dev
```

The map fetches CARTO's Positron vector basemap. Its own inventory, PMTiles, binary summary and details are static assets. No routing or graph data reaches the browser. Use `npm run build` for `dist/`; serve it on a static host with HTTPS. The build also emits 64 KiB tile chunks so the deployed map works on hosts that ignore HTTP Range requests; at most four verified chunks are retained in the transport cache. MapLibre's worker is bundled explicitly for production.

## What works

- Linear-time Rust array solver, checked arithmetic and indices, deterministic witnesses, directional maximum, uncertainty propagation from all predecessors, cycle/approach quarantine, exact equality classifier.
- Streaming NDJSON CLI inputs, small binary summary distributions, unique-segment aggregation, checked browser integer range and checked u32 score exports.
- WGS84 geodesic designated lengths, citywide coverage and optional Ward 35 clipping, overlap/reversal deduplication, immutable build directories and SHA-256 asset checks.
- PMTiles rendering, threshold slider and numeric input, animation-frame batching, keyboard controls, passing filter, on-demand details and optional full-run geometry, bounded caches, mobile layout and canonical share URLs.
- Disk-backed SQLite OSM staging and an R-tree for candidate review. All original objects and restriction relations are retained. The graph solver does **not** infer legal motor movements from candidate proximity.

## Reproduce data

The official designation snapshot is December 2025; CNT's comparison map says August 2026. Newer completed-project reconciliation remains open. Retrieval dates are UTC; the source acquisition took place on September 18 local Chicago time / September 19 UTC.

```sh
npm run data:snapshot
# Download the file identified by data/sources/osm-source.json.
# It is retained locally at data/sources/Chicago.osm.pbf and excluded from Git.
curl -fL https://download.bbbike.org/osm/bbbike/Chicago/Chicago.osm.pbf -o data/sources/Chicago.osm.pbf
npm run network:stage
npm run network:review
npm run data:build
npm run build
```

For exact reproduction, use the saved snapshot and verify its checksum: a `latest` download will eventually change. The local OSM snapshot is dated September 11, 2026. The SQLite stage is regenerable and excluded from Git. `data/review/city/matches.json` preserves inspectable geometry, tags and evidence URLs for 715 candidate ways. 1,400 of 1,452 intervals have candidates, with 25 directly attached restriction relations. These are candidates, not approved matches; complete relations remain in SQLite.

Citywide is the default scope. To regenerate the original pilot scope, run `npm run network:review -- --scope ward35` then `npm run data:build -- --scope ward35`. The original immutable Ward 35 build remains available (40 intervals, 2.59391 miles). Scope-specific normalized and review files are kept separately. The map’s Ward 35 button changes the viewport only; totals remain citywide.

`data:build` refuses to overwrite an immutable build. Change inputs/algorithm to produce a new ID. `public/current.json` selects the displayed build. Old builds remain available. It refuses to silently ignore nonempty overrides.

## Complete the street audit

See [remaining work and release gates](docs/implementation-status.md). The outstanding normalization work is substantive: split at real intersections and condition changes, interpret motor access/one-way/restrictions, normalize connectors and ambiguous movements, trace full corridors, and review every endpoint that would allow a pass.

A reviewed, fully normalized bundle can already feed the solver and publication path:

```sh
node scripts/build-data.mjs /absolute/path/to/reviewed-bundle
npm run build
```

Bundle contract: [docs/data-contract.md](docs/data-contract.md). This path exports scores and deterministic deduplicated full-run geometry. The default path publishes the unresolved official inventory. It never promotes raw OSM candidates into accepted movements.

## Validation

```sh
npm run fixtures
npm test
cargo test --manifest-path solver/Cargo.toml
cargo clippy --manifest-path solver/Cargo.toml --all-targets --locked -- -D warnings
npm run build
```

Tests include 1,000 generated DAGs versus an independent exhaustive oracle; chains and splits; unequal merges and shorter uncertain branches; cycles; equality and directional aggregation; overflow; geometry duplicate/overlap removal; full-path witnesses; binary summaries compared to unique records around every score; monotonicity and integer URL/display round trips. [Validation measurements and limits](docs/validation.md).

## Licensing and attribution

Source code: MIT (see LICENSE). City of Chicago data remains subject to its portal terms. OSM source data is © OpenStreetMap contributors, ODbL 1.0; see the saved source manifest. Basemap © CARTO and © OpenStreetMap contributors. Keep source and map attributions when publishing. Unreviewed source candidates are evidence, not a cycling safety assessment.
