# Route data and configuration contract

This document describes the current route-based artifacts. [Methodology](methodology.md) explains their interpretation. JSON is generated from saved inputs; edit the authoritative inputs, then rebuild and verify rather than editing generated copies.

## Inputs

| Input | Purpose |
| --- | --- |
| [greenways.json](../data/sources/greenways.json) | Saved city designation rows, geometries and original IDs; the city manifest records its URL, retrieval time and SHA-256. |
| [osm-source.json](../data/sources/osm-source.json) | OSM extract provenance and checksum. The staged `data/staging/network.sqlite` contains nodes, ways, relations and a way bounding-box index. |
| [pilots.json](../data/routes/pilots.json) | Route selection, matching and explicit review bindings. Its filename is retained even though the export covers the saved inventory. |
| [review-evidence.json](../data/routes/review-evidence.json) | Editable source observations and citations. Source-inferred evidence is not field approval. |

The city file's hash is checked against [sources.json](../data/sources/sources.json) before route construction. The staging database is read-only to the route builder. The OSM extract can be staged using `npm run network:stage`; preserve and compare manifests when replacing snapshots.

## Configuration

Each entry in `streets` has `name`, `source` and an `axis` of `north` or `east`. The axis establishes route ordering and direction labels, not a claim that every bent segment is cardinal. `source_aliases` explicitly lists accepted source-name variants; `additional_source_ids` selects exact existing city rows. IDs remain attached to the route.

Optional bindings are scoped to their named component and validated by their respective helpers:

- `component_ids`: `{source_id, route_id}` anchors a stable component ID. Anchors must be unique, belong to one component and produce no duplicate IDs; unbound components use the prefix and one-based position.
- `explicit_ways`: `{route_id, city_source_ids, way_ids, evidence_id}` selects exact OSM roads supported by evidence when names differ. Evidence must bind every listed city and way ID. It grants no access permission; bound-line, corridor and heading checks still apply.
- `scoped_ways`: a reviewed, ordered node slice with city-source and route bindings. Its topology and distance to city geometry are checked before insertion.
- `split_carriageways`: a reviewed pair or two chains of opposite carriageways, city and evidence bindings, and optional reviewed branches. Topology, access, attachments and bounded geometry are checked.
- `unresolved_components`: exact component source IDs and evidence identifying a wholly unresolved correspondence. It preserves an unknown gap rather than inventing a match.
- `review_connection`: an evidence-bound connection between distinct components with an explicit maximum distance. The connection groups review scope; it does not by itself authorize motor passage.

Top-level `max_source_distance_m` and `endpoint_tolerance_m` configure matching and endpoint handling. See [builder](../scripts/build-route-data.mjs) and helper implementations for validation details; configuration is not a generic permission override.

## Route export

`public/routes/pilot.json` has `schema_version`, `generated_at`, `source`, `routes` and `summary`. `source` carries attribution, snapshot dates and OSM hash. `summary` counts route components and movements and labels evidence `source-inferred`. `SOURCE_DATE_EPOCH` controls `generated_at` when set. Dates and counts are properties of the current artifact, not permanent guarantees.

Each route contains:

| Field | Meaning |
| --- | --- |
| `id`, `name`, `extent_label`, `direction_labels` | Component identity and display labels. Stable IDs are guaranteed only where bound; display cross streets may be unresolved. |
| `source_ids`, `bounds`, `geometry` | City row IDs, coordinate bounds and source designation LineString or MultiLineString. Coordinates are longitude, latitude. |
| `edges` | Ordered matched road, junction, connector or gap geometries; lengths are metres. A gap has null way and node IDs and ordinarily unknown access. A curated, evidence-bound installed filter can yield a source-inferred blocked decision while its geometry remains unmatched; it is not a generic gap closure. Some matched edges carry explicit `matching` metadata. |
| `movements` | Directional approach-to-departure decisions between adjacent edges, with coordinate and evidence URLs. A geometrical connection is not necessarily an allowed movement. |
| `runs` | Directional continuous allowed paths, their edge IDs, geometry, length, boundary reasons, and scope/completeness flags. Direction-specific junction traversals can have different geometry and length. |
| `events` | Directional blocked or unknown access and movement observations for display. |
| `coverage` | Designated, matched and unknown metres and movement counts; matching coverage is not field verification. |

Access and movement decisions contain `status` (`allowed`, `blocked`, `unknown`), `reason`, `kind` and `evidence_status`, with optional source identifiers. `source-inferred` applies to allowed decisions too. `scope_end` indicates the edge of the mapped designation; it is not a barrier. Gaps, conditional rules, unsupported restrictions and unresolved endpoints must not be converted to known access merely to complete a run.

## Evidence, coverage and validation artifacts

- `data/routes/evidence-catalog.json` and `public/routes/evidence-catalog.json` are derived from review evidence. The catalog contains sources, observations, bindings, search gaps and raw evidence. Citation dates describe their stated meaning; `snapshot_url` can identify the actual extract a hash covers. The compiler checks internal consistency, not source authenticity. See [catalog documentation](evidence-catalog.md).
- `data/routes/coverage-inventory.json` and `public/routes/coverage-inventory.json` report eligible city-row representation, remaining rows and source-attribute miles, with source and route hashes. They do not count distinct projects or certify matching.
- `data/routes/pilot-validation.json` records sample checks, targeted checks, skips, input and staged-database hashes, and audit scope. Its samples and `field_approvals` do not establish comprehensive field review.
- `public/routes/review-evidence.json` is the generated public copy of editable review evidence.

`npm run data:routes` rebuilds the route export and the evidence and coverage catalogs. `npm run data:evidence` and `npm run data:coverage` rebuild those catalogs individually; `npm run verify:evidence` and `npm run verify:coverage` check freshness. `npm run verify:routes` checks route structure, and `npm run audit:routes` runs snapshot-based audit checks. `npm test` exercises JavaScript and web tests. Consult [package.json](../package.json) for commands and [implementation](../scripts/build-route-data.mjs) for the exact current schema.

The active route UI loads `public/routes/pilot.json` and also requires `public/current.json`, the referenced `public/builds/` PMTiles, and `public/tile-chunks/` for its muted designation background. Legacy normalized solver inputs, scores and binary threshold summaries belong to the older straight-line pipeline and are not consumed as route analysis by the active UI. Those build assets remain necessary background infrastructure; they are not the authoritative route export.

**Snapshot refresh:** the route builder currently writes designation and OSM dates as literals. Refreshing source manifests alone does not update these output dates; update and verify the literals against the new snapshots when refreshing data.
