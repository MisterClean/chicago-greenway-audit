# Validation record — September 18, 2026 (Chicago)

Device: Apple M1 Pro, 32 GiB RAM, arm64 macOS / Darwin 25.5.0. Node 24.18.0. Rust 1.94.0. MapLibre 6.10.0, PMTiles 4.5.0, Tippecanoe 2.79.0. Renderer configured with 2 workers, 64 cached tiles per source, 3 cache zoom levels, 16 PMTiles directory entries and 12 cached segment details.

## Automated correctness

- Eight Rust tests pass, including 1,000 generated acyclic graphs independently enumerated by a path oracle.
- Five JavaScript/TypeScript tests pass: duplicate and partial-overlap inventory, full-run witness selection, equality and input bounds, Rust binary summary agreement at and adjacent to every fixture score, partition/monotonicity, and exact millimetre URL/display round trips.
- Clippy all targets with warnings denied passes. Production TypeScript/Vite build passes, including separately bundled map worker.
- `scripts/verify-assets.mjs` validates all manifest checksums and every decoded PMTiles fragment against unique offline scores, then verifies that all 40 segment IDs occur in the archive. This never uses tile fragments to calculate mileage.

These tests validate numerical and delivery behavior. They do not validate Chicago driving movements. The accepted-street graph is currently empty by design.

## Observed performance

Measured with release Rust and `/usr/bin/time -l`, one invocation per stage. Maximum resident set size is reported by the operating system; this is not an end-to-end browser memory figure.

| Stage | Input | Elapsed / measurement | Peak RSS |
| --- | --- | --- | --- |
| Rust solver | 1,000,000 synthetic states, one chain | 21.882 ms inside solver | 49,922,048 bytes (47.6 MiB) |
| Full OSM streaming → SQLite/R-tree | 101,927,683-byte PBF; 11,223,484 nodes, 2,075,061 ways, 17,598 relations retained | 53.43 s wall clock | 411,303,936 bytes (392.2 MiB) |
| Summary lookup | 10,000 updates on six-segment mixed-status fixture, after warmup | p95 0.000334 ms; max 0.295042 ms | Not measured separately |
| Pilot summary / PMTiles | 40 unresolved designation intervals | 48-byte summary; 11,577-byte PMTiles archive | Not measured separately |

An initial `osmium extract`/`tags-filter` approach consumed ~3.7 GiB / ~2.1 GiB and was rejected. The final staging script streams the complete source with one Osmium parser pool thread into disk-backed SQLite, retaining raw relation information and using a bounded SQLite cache. Do not reintroduce the rejected extraction path as the default.

The summary microbenchmark is a tiny synthetic fixture, not a citywide browser latency benchmark. The million-state graph is synthetic, not a Chicago performance result.

## Browser checks

Codex in-app Chromium browser, desktop 1440×1000 and mobile 390×844, plus normal in-app viewport. Checked both development and production builds. Browser version is not exposed in the test interface, so no version-specific latency claim is made.

- Map renders real street basemap, ward outline and PMTiles greenway geometry; attribution present.
- Keyboard arrow advances slider by 0.125 miles; typed 3.145 miles expands slider without clamping.
- Selection shows source cross streets, unresolved endpoint reasons, designated length and evidence links. Source cross streets are explicitly distinguished from driving endpoints.
- Passing-only filter removes unresolved selection, keeps designation baseline and shows a correct empty state.
- Mobile control, summary and selector fit without the earlier overflow; map remains a separate unobscured area below them.
- WebMCP threshold tool registered, valid input updates the same controls/totals; invalid negative input fails and leaves the valid value unchanged.
- Production browser error log was empty after map load. A missing development worker and an incomplete production worker bundle were caught and fixed.
- Threshold code performs only style/filter changes and summary lookup. It contains no routing call or threshold-triggered fetch. A network trace was not available through the browser interface; do not claim measured zero network requests.

## Remaining acceptance work

- Automated OSM movement normalization and audited geometry matching.
- Pilot endpoint review and validation of resolved real-world full-run witnesses.
- Conditional/via-way rules, grade-separated crossings, junction connectors, bends and contraflow integration fixtures.
- Newer designation/project reconciliation and citywide expansion.
- Browser response p95 on a recorded browser version and physical device, and repeated-sweep total browser/worker/graphics memory plateau.
- Complete stage-by-stage preprocessing peak measurements for a scored Chicago build.
