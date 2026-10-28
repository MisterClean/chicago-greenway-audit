# Data guide

The active map follows designated greenways in each direction. [Current contracts](../docs/route-data-contract.md) describe its artifacts; [Development](../docs/development.md) explains reproduction. Saved inputs are snapshots, not live conditions or field approvals.

| Path | Role | Edit or regenerate? |
| --- | --- | --- |
| `sources/greenways.json`, `sources/sources.json`, `sources/bike-routes-metadata.json` | Retained city extract, retrieval fingerprints and portal metadata. Scope is exactly `Neighborhood Greenway`. | Preserve together; acquire and reconcile a new snapshot deliberately. |
| `sources/osm-source.json` | Date, hash and provenance for the OSM extract. | Keep consistent with the exact staged PBF. |
| `sources/Chicago.osm.pbf`, `staging/network.sqlite` | Large raw OSM extract and derived road network. Ignored by Git. | Required to regenerate routes and run source audits, not to run the app. |
| `routes/pilots.json` | Authoritative route configuration, aliases, explicit matches and unresolved-component bindings. | Edit with scoped evidence. Filename retained for compatibility. |
| `routes/review-evidence.json` | Authoritative observations, citations, dates, source bindings and search gaps. | Edit with provenance; never equate designation or proposal with installed motor rules. |
| `routes/evidence-catalog.json`, `routes/coverage-inventory.json` | Derived evidence index and exact city-row coverage. | Rebuild using the documented commands; do not hand-edit. |
| `routes/pilot-validation.json` | Source-based audit tied to the route export and staging hashes. | Regenerate after changing the export, then inspect failures and review skips. |
| `experiments/` | Dated investigations of source data and movement behavior. | Research history, not the production export. |
| `fixtures/`, `normalized/`, `review/` | Historical interval/solver inputs, outputs and candidate reviews. | See the [historical contract](../docs/data-contract.md); not current driving-distance results. |

The active downloadable assets live in [`public/routes/`](../public/routes/). The app also uses `public/current.json`, the referenced PMTiles build and `public/tile-chunks/` for the muted city designation background. Preserve that dependency even though the older binary scores are not consumed by the route interface.
