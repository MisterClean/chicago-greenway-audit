# Chicago Greenway Audit

A route-based map of how far an ordinary car can follow a Chicago bicycle greenway in each direction. It follows the designated route through turns, shows continuous driving stretches, and explains the restrictions or unknown connections at their ends.

**The current interface is a source-inferred pilot, not a completed driving or cycling-stress audit.** It covers 64 route sections on Wood, Berteau, Leland, Dickens, Manor, Kenmore, Glenwood, George, Loomis, 124th Street, School, Roscoe, Winthrop, Ardmore, Winnemac, Ainslie, Carmen, Argyle, Aldine, Cortland, Berwyn, Polk, Leavitt, Granville, 24th, 28th, 30th, Rockwell, Lyndale, Wrightwood, Bloomingdale, Hamlin, Keeler, Lavergne, Long, Menard, Kilbourn, Avers, Central Park, Hirsch, Le Moyne and Cullom. None of its 3,610 movement boundaries is field reviewed. The citywide designation inventory remains a muted background layer.

## Run

Node 24+ is sufficient to run and build the map from committed assets:

```sh
npm ci
npm test
npm run verify:routes
npm run build
npm run dev
```

Select a route and direction, then select a colored path. The panel shows its full mapped length and endpoint reasons. Click a point or use the keyboard-accessible position slider to measure the distance remaining in that direction. Share links preserve the route, direction, selected stretch or interruption, measurement and map position. Unknown links and conflicting sources remain visible. Interruption details include source links and a manual Street View launch link.

The static app uses MapLibre and CARTO's Positron basemap. Pilot data is in `public/routes/`; the city background uses existing PMTiles and static tile chunks for hosts without HTTP Range support. No routing server or API key is required. `npm run build` writes `dist/`.

## Model and evidence

The car profile is a general through trip, without resident, delivery or emergency exceptions. Stops, signals and humps do not break continuity. A prohibited movement, one-way restriction, physical filter, or through-access restriction does. Cars cannot detour off the selected route and rejoin within the same run.

- Ordered route edges and approach-to-departure movements replace the old geometry-interval score as the primary map model.
- Forward and reverse access are evaluated separately. Motor-specific rules override generic access; bicycle exceptions never authorize cars.
- Small traffic circles use the legal approach-to-departure arc in each direction, with separate geometry and distance. Ambiguous paths and inconsistent circulation tags remain unresolved.
- Explicit route joins, unmatched geometry, conditional rules, unsupported restrictions and conflicting sources remain unknown until resolved.
- Runs include only allowed edges connected by allowed movements. Distances follow WGS84 geometry and are clipped to route scope. An unknown boundary is not a verified maximum; a designation endpoint is not a physical road closure.
- Each decision retains its reason and source links. Selected official records and manual-viewing notes form a review queue, not field approvals.
- New project evidence is scoped to its city designation records. Detailed CDOT drawings, ward construction updates and current observations have different meanings; missing plans and uncertain installation dates remain explicit. Reports of time-dependent gates annotate the affected gap without inventing a permanent closure. A curated installed-filter observation can block a specific unmatched passage only when the documented connection is corroborated by exact source nodes, a terminal road/cycleway junction and no mapped motor exit at that node. Its geometry can remain unmatched, and it remains source-inferred.

Vehicle continuity measures potential through access. Traffic volume, speed and crossing conditions are also needed to assess cycling stress.

Read the [tested implementation plan](docs/vehicle-continuity-plan.md) and [current expansion and validation](docs/route-ten-greenways-validation.md). The latter documents project-specific evidence, source limitations, 248 independently sampled directional junction decisions, and targeted regression cases. Earlier checkpoints are preserved in the [Bloomingdale/Hamlin review](docs/route-bloomingdale-hamlin-validation.md), [Rockwell/Lyndale/Wrightwood review](docs/route-rockwell-lyndale-wrightwood-validation.md), [Leavitt/Granville/Little Village review](docs/route-leavitt-granville-validation.md), [Aldine/Cortland/Berwyn/Polk review](docs/route-aldine-berwyn-polk-validation.md), [Winnemac/Ainslie/Carmen/Argyle review](docs/route-north-validation.md), [School/Roscoe/Winthrop/Ardmore review](docs/route-plan-review-validation.md), [first expansion](docs/route-expansion-validation.md) and [original pilot](docs/route-pilot-validation.md).

The [evidence catalog](docs/evidence-catalog.md) links 178 observations and 483 citations to 218 source URLs. It preserves source titles and publishers when known, date meanings, inspected pages, document/extract checksums, conflicting metadata, search gaps and original records. Missing metadata remains explicit. The app's Sources & method panel links the downloadable JSON. `npm run data:evidence` rebuilds it; `npm run verify:evidence` checks that both copies match the editable evidence. Production builds reject a stale catalog.

The [coverage inventory](data/routes/coverage-inventory.json) counts exact exported city IDs: 186 of 258 records are represented; **72 remain, totaling 15.27 city-recorded miles across 46 raw street-name labels**. The scope is exactly CDOT’s `displayrou = Neighborhood Greenway` category. The live portal response was rechecked October 27, 2026 and matches the saved 258 rows byte for byte; the portal remains dated December 2025. Other facility categories are rejected before generation. See the [scope verification](docs/cdot-inventory-scope-review.md). Labels include connectors and spelling variants, so this is not a count of distinct projects or completed field reviews. `npm run verify:coverage` checks that the inventory matches the export; production builds require it.

## Reproduce the pilot

The committed export is usable without the large source files. Rebuilding requires the saved December 2025 city designation snapshot and September 11, 2026 OSM extract, plus the SQLite network stage:

```sh
# If the recorded OSM extract is present but the SQLite stage is not:
npm run network:stage

# Rebuild and validate the route export:
npm run data:routes
npm run verify:routes
npm run audit:routes
npm test
```

`data/sources/osm-source.json` identifies the exact extract and checksum. The local PBF and SQLite stage are excluded from Git; downloading a changing `latest` URL does not reproduce this build. Raw staging requires Osmium 1.19+.

`data/routes/pilots.json` defines route scope, explicitly catalogued source-name aliases, and documented connections requiring review. The `BERWN` alias includes the western Berwyn designation without rewriting the raw city record. Aldine/Broadway, Roscoe/Broadway, Berwyn/Sheridan, Rockwell/Fullerton, Lyndale/Western and Bloomingdale’s Monitor/Central jogs include exact additional city IDs and bounded motor-carriageway slices. Wrightwood’s ambiguous divided-road component and Hamlin’s unresolved boulevard jog remain entirely unmatched through evidence-bound reviews; no alternative road is selected by proximity alone. Lavergne and Menard’s short divided-road pairs retain separate directional geometry and unresolved city-direction conflicts. The unnamed 30th Street link is admitted only as an exact city-aligned node slice; its motor-direction conflict is retained. `scripts/route-network.mjs` assembles and matches the route, `scripts/scoped-route-ways.mjs` checks explicitly bound short street-name changes against city geometry, `scripts/motor-rules.mjs` evaluates source rules, `scripts/split-carriageways.mjs` validates explicitly bound short pairs of opposing carriageways, `scripts/junction-traversal.mjs` follows their legal arms and small circular junctions, and `scripts/route-continuity.mjs` traces each direction. `scripts/build-route-data.mjs` exports routes, events and runs to `public/routes/pilot.json`, copies the evidence queue and rebuilds the catalog and remaining inventory. `web/src/route-map.ts` renders the interface.

Use `SOURCE_DATE_EPOCH=1793091600 npm run data:routes` for the audited export's fixed generation timestamp. The independent sample in `data/routes/pilot-validation.json` is tied to the output SHA-256 and becomes stale when that output changes. Source records and timestamps must be checked again before approving movements or expanding the pilot.

## Validation

`npm test` covers direction/access precedence, barriers, turn restrictions, conditional and via-way uncertainty, source conflicts, route gaps and clipping, circular junctions, tracing across bends, subdivision invariance, and remaining distance in either direction. `npm run verify:routes` independently checks the generated geometry, geodesic lengths, legal continuity, endpoint reasons, coverage and known pilot cases. With the source SQLite stage available, `npm run audit:routes` reproduces the sampled junction checks and targeted source comparisons. These checks do not establish current street conditions.

Desktop and narrow-screen browser checks cover route/direction selection, clicking a run, remaining distance, interruption details and share-link restoration. The pilot deliberately has no low-stress pass/fail badge.

## Earlier inventory and solver

The original [technical specification](docs/technical-spec.md), Rust solver, TypeScript inventory interface and immutable citywide builds are retained for reference. They are not the new map's calculation path. The old inventory contains 1,452 geometry intervals over 85.23654 designated miles from 258 official records; its zero/unknown scores are not used as vehicle-continuity results.

Historical commands remain available: `npm run fixtures`, `npm run data:build`, `npm run network:review`, `npm run data:verify`, and `npm run verify`. These may require Rust/Cargo, Tippecanoe 2.79+ and the raw source snapshots. See the previous [data contract](docs/data-contract.md) and [validation notes](docs/validation.md) for that export format.

## Licensing and attribution

Source code: MIT (see LICENSE). City of Chicago data remains subject to its portal terms. OSM source data is © OpenStreetMap contributors, ODbL 1.0; see the saved source manifest. Basemap © CARTO and © OpenStreetMap contributors. Keep source and map attributions when publishing.
