# Data contracts

## Normalized CLI inputs

`greenway-solver STATES.ndjson SEGMENTS.ndjson OUTPUT_DIRECTORY`

Each state is one permitted traversal of one normalized physical road edge:

```json
{"id":0,"length_mm":123000,"next":1,"up_open":true,"down_open":false}
```

IDs must be dense from zero; null successor means none. `up_open` and `down_open` cover unresolved topology and legality, including both sides of ambiguous movements. A verified blocked straight movement can end a run, but an unexplained missing edge cannot. Do not emit uncertain motor access as known drivable length. With uncertain legality, retain the physical segment as unresolved until permitted states can be established. Lengths are unsimplified geodesic millimetres. The solver validates structure and arithmetic; the importer/reviewer is responsible for movement semantics.

```json
{"sid":1,"gw_mm":123000,"states":[0,8],"directions_resolved":true,"inaccessible":false}
```

One record per unique designated interval. State IDs refer to potentially controlling permitted directions on that interval, not to arbitrary streets. Proven inaccessibility requires no states and resolved directions. Unmatched intervals have no states, unresolved directions and `inaccessible:false`. Duplicate IDs are errors. Overlapping designation mileage must already be deduplicated.

Outputs: `scores.ndjson`, `witnesses.ndjson`, `summary.bin`. A state entering a cycle has lower bound zero and cannot pass. All distance additions are checked u64; exported individual distances are checked u32. JavaScript totals must be safe integers.

## Reviewed publication bundle

Pass its directory as the argument to `scripts/build-data.mjs`. The default scope is `city`; use `--scope ward35` for a ward-clipped bundle. Scope-specific normalized inputs and solver outputs go under `data/normalized/<scope>/`, and candidate reports under `data/review/<scope>/`. Segment IDs are local to a build, not stable across scopes.

The bundle contains:

- `review.json`: `reviewer`, `evidence_date` (YYYY-MM-DD), `reason`, `source_snapshot_sha256` (the retained official greenways snapshot), and `override_version`.
- `inventory.json`: array of `{sid, gw_mm, coordinates, sources}`. `sources` contains the original source records, including `:id`, `street`, `f_street`, `t_street`. Split these intervals at every change in score. Keep designated lengths separate from state lengths.
- `states.ndjson`, `segments.ndjson`: the normalized CLI contracts above.
- `state-details.json`: dictionary by state ID, containing `direction`, `upstream_reason`, `downstream_reason`, `geometry` (unsimplified GeoJSON LineString), and `evidence` (`{label,url}` array). Endpoint descriptions must be appropriate for the start/end state selected by the witness pointers.

Review metadata is required; this does not automatically validate the correctness of a review. The current raw candidate files are intentionally a different schema, so they cannot be accidentally published as reviewed inputs.

The publisher follows the controlling state's predecessor pointers to its longest upstream start, then its accepted successors to the downstream end. Each full path is written once to `runs/<start-state>.json`. Details reference `run_id`; the map fetches it on selection and keeps only one run source. Cycle witnesses are never traversed.

## Summary binary, schema 1

All values little-endian. Header is 32 bytes:

| Offset | Type | Value |
| --- | --- | --- |
| 0 | 8 ASCII bytes | `GWAYIDX1` |
| 8 | u32 | version 1 |
| 12 | u32 | exact distribution count |
| 16 | u32 | all distribution count |
| 20 | u32 | reserved zero |
| 24 | f64 | total designated millimetres (safe integer) |

Then exact distribution, then all distribution. Each has `count` u32 ascending distinct scores, zero padding to an 8-byte boundary, then `count` Float64 inclusive cumulative designated lengths. No objects per record. Empty arrays have zero records. The last all cumulative sum must equal the header total. Use lower-bound search (first score >= X), never upper-bound search. Passing + failing + unknown must equal total exactly.

## Threshold and URL

One internal integer: `round(miles * 1609344)`. Numeric entry accepts 0.01–20 miles. URL `x_mm` preserves this integer exactly; `map=zoom,latitude,longitude` records the viewport. Display uses the shortest decimal that rounds to the same integer. This precision is for reproducibility, not survey accuracy.

## Build assets

`public/current.json` points to an immutable `public/builds/<build_id>/` with manifest, summary, PMTiles, catalog, optional ward geometry and on-demand details/runs. Features carry `sid, lb_mm, exact, gw_mm, detail_id`; all tile fragments retain the same values. Summaries never sum rendered fragments. The manifest hashes all build assets. It records geographic scope, display label, geometry bounds, normalized output directory, source checksums, effective/retrieval dates, licenses, policy, algorithm, review state and cache settings.
