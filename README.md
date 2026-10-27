# Chicago Greenway Audit

A route-based map of how far an ordinary car can follow a Chicago bicycle greenway in each direction. It follows the designated route through turns, shows continuous driving stretches, and explains the restrictions or unknown connections at their ends.

**The current interface is a source-inferred pilot, not a completed driving or cycling-stress audit.** It covers 16 route sections on Wood, Berteau, Leland, Dickens, Manor, Kenmore, Glenwood, George, Loomis and 124th Street. None of its 867 movement boundaries is field reviewed. The citywide designation inventory remains a muted background layer.

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

Vehicle continuity measures potential through access. Traffic volume, speed and crossing conditions are also needed to assess cycling stress.

Read the [tested implementation plan](docs/vehicle-continuity-plan.md) and [expanded validation and remaining review](docs/route-expansion-validation.md). The latter documents source limitations, 64 independently sampled directional junction decisions, and targeted regression cases. The [original pilot validation](docs/route-pilot-validation.md) preserves the earlier four-street checkpoint.

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

`data/routes/pilots.json` defines route scope and explicit joins. `scripts/route-network.mjs` assembles and matches the route, `scripts/motor-rules.mjs` evaluates source rules, `scripts/junction-traversal.mjs` follows small circular junctions, and `scripts/route-continuity.mjs` traces each direction. `scripts/build-route-data.mjs` exports routes, events and runs to `public/routes/pilot.json` and copies the evidence queue. `web/src/route-map.ts` renders the new interface.

Use `SOURCE_DATE_EPOCH=1793091600 npm run data:routes` for the audited export's fixed generation timestamp. The independent sample in `data/routes/pilot-validation.json` is tied to the output SHA-256 and becomes stale when that output changes. Source records and timestamps must be checked again before approving movements or expanding the pilot.

## Validation

`npm test` covers direction/access precedence, barriers, turn restrictions, conditional and via-way uncertainty, source conflicts, route gaps and clipping, circular junctions, tracing across bends, subdivision invariance, and remaining distance in either direction. `npm run verify:routes` independently checks the generated geometry, geodesic lengths, legal continuity, endpoint reasons, coverage and known pilot cases. With the source SQLite stage available, `npm run audit:routes` reproduces the sampled junction checks and targeted source comparisons. These checks do not establish current street conditions.

Desktop and narrow-screen browser checks cover route/direction selection, clicking a run, remaining distance, interruption details and share-link restoration. The pilot deliberately has no low-stress pass/fail badge.

## Earlier inventory and solver

The original [technical specification](docs/technical-spec.md), Rust solver, TypeScript inventory interface and immutable citywide builds are retained for reference. They are not the new map's calculation path. The old inventory contains 1,452 geometry intervals over 85.23654 designated miles from 258 official records; its zero/unknown scores are not used as vehicle-continuity results.

Historical commands remain available: `npm run fixtures`, `npm run data:build`, `npm run network:review`, `npm run data:verify`, and `npm run verify`. These may require Rust/Cargo, Tippecanoe 2.79+ and the raw source snapshots. See the previous [data contract](docs/data-contract.md) and [validation notes](docs/validation.md) for that export format.

## Licensing and attribution

Source code: MIT (see LICENSE). City of Chicago data remains subject to its portal terms. OSM source data is © OpenStreetMap contributors, ODbL 1.0; see the saved source manifest. Basemap © CARTO and © OpenStreetMap contributors. Keep source and map attributions when publishing.
