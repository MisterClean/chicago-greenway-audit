# Route-based methodology

The map follows the designated Neighborhood Greenway in each direction for an ordinary passenger car making a through trip. It reports source-inferred continuous driving paths, interruptions and unresolved sections. These are **not field approvals**, traffic counts, legal advice or measurements of cycling comfort. A city bike designation does not itself authorize motor traffic.

## Scope and sources

The saved City of Chicago Bike Routes extract includes rows whose `displayrou` is exactly `Neighborhood Greenway`. It excludes other bicycle and trail categories. The source file and retrieval details are in [the city manifest](../data/sources/sources.json); the OSM extract's date, hash and attribution are in [the OSM manifest](../data/sources/osm-source.json). OSM is an independently mapped snapshot, not a current sign inventory. Live source links can change after the saved extract.

[Coverage inventory](../data/routes/coverage-inventory.json) tracks representation of city rows in the route export. A represented row can still contain unknown matching or movement; it is not a distinct project count or a field-verified route. Source-attribute mileage sums are not deduplicated driving lengths.

## From city rows to routes

1. [Route configuration](../data/routes/pilots.json) selects source names, explicit aliases and additional city IDs. [The builder](../scripts/build-route-data.mjs) assembles adjoining designation geometry into oriented components and preserves source IDs. Some documented connectors group separate city lines for review; a schematic connector is not automatically a motor route or designated mileage.
2. The builder reads the saved OSM SQLite network and seeks nearby named and eligible unnamed roads. [The matcher](../scripts/route-network.mjs) uses geometry, heading and shared OSM node identity; crossing lines without a common node do not connect. The configured source-distance limit is 18 metres. Source gaps and uncertain associations remain unknown rather than taking an off-route shortcut.
3. Explicit correspondences handle a reviewed city row whose carrying road has another name. They require an evidence-bound city ID and way ID, valid road geometry and a component binding. The match is also sampled at intervals of at most one metre against the bound city lines, then passes ordinary component corridor and heading checks. It does not override access. Scoped way slices and split carriageways have separate, explicit validation.
4. The selected connected path is ordered, with endpoints clipped to the city designation when supported. A route may have bends and permitted turns; a car cannot leave it to bypass an obstruction. A city `-` direction value is no assertion, and bicycle contraflow does not grant car travel.

The exact candidate and topology rules live in [the matcher](../scripts/route-network.mjs), [explicit road correspondence](../scripts/explicit-road-matches.mjs), [scoped slices](../scripts/scoped-route-ways.mjs), and [split carriageways](../scripts/split-carriageways.mjs). An automatic correspondence is an inference, not proof of current conditions or a claim that every map lane has been identified.

## Access, movements and runs

[Motor rules](../scripts/motor-rules.mjs) interpret way and node tags and turn-restriction relations for each direction. Motor-specific tags take precedence over broader vehicle and access tags. A destination-only road does not support a general through trip. Conditional restrictions and unsupported values require review; via-way turn restrictions are unknown when path history is required. Absence of a mapped restriction is not proof that a turn is legal today.

Signals, stop signs and speed humps do not by themselves break a permitted path. Physical barriers, one-way restrictions, limited access and prohibited movements can interrupt it. A bike-only connection does not by itself establish a car connection; a separate adjacent roadway must be matched and evaluated. Most unmatched gaps retain unknown access. A curated installed filter can instead support a source-inferred blocked decision at an unmatched gap when its city-row scope, exact source nodes and connection topology, and evidence bindings pass the builder’s checks. The correspondence remains unmatched; this exception is not a generic closure or a field approval.

Circular junctions need the mapped topology and car direction. A `junction=circular` tag alone does not establish a direction. When a supported circular junction is traced, the two directions may have different arcs and lengths. Explicitly reviewed split carriageways likewise require bounded topology and evidence; a split does not establish permission to turn at its endpoints. See [junction traversal](../scripts/junction-traversal.mjs).

[The route tracer](../scripts/route-continuity.mjs) scans the ordered edges in each direction. A run includes only allowed edges connected by allowed movements. A known block ends the run; unknown information also prevents asserting continuity. A boundary may be `blocked`, `unknown`, or `scope_end`. A scope end means the mapped greenway ends, **not** that cars are physically blocked there. `complete_within_route` concerns resolved boundaries within that scope, not a field approval or driving beyond the designation.

## Distances and interpretation

Edge and directional traversal lengths are geodesic metres from their exported geometry. Runs sum the appropriate directional edge lengths; circular arcs may differ by direction. Coverage `designated_m`, `matched_m` and `unknown_m` describe the source alignment and gap accounting, not surveyed pavement, traffic exposure or verified car mileage. Mileage in the inventory sums the city's `mi_ctrline` attributes; it has a different meaning and should not be compared as an exact route-length total.

A selected run is clipped to the mapped greenway, so it is not a longest trip in the wider street network. Unknown boundaries limit what can be concluded. Reported precision makes the data reproducible, not survey accurate.

## Evidence and checks

[Review evidence](../data/routes/review-evidence.json) binds observations to source IDs, ways and citations. [The derived catalog](../data/routes/evidence-catalog.json) indexes citation scope, dates, hashes where available, and search gaps. A historical plan, construction notice or contextual report is not a present-day as-built finding; hashes identify the stated document or saved extract, not necessarily the live URL. See [evidence catalog details](evidence-catalog.md).

The build verifies source and artifact consistency; [the route audit](../scripts/audit-route-samples.mjs) checks selected source-based movements and targeted cases. These checks do not verify every route, sign, barrier or movement in the field. The output remains `source-inferred`, including where an access decision is `allowed`.

## Historical straight-line pipeline

The earlier [solver contract](data-contract.md) and [technical specification](technical-spec.md) describe a separate straight-ahead threshold and reviewed-bundle pipeline. Its normalized states, binary summary and scoring semantics are not the route-following method above. The active entry point is [the route map](../web/src/route-map.ts); the older [main.ts](../web/src/main.ts) and Rust solver remain in the repository for the historical pipeline. Do not use its straight-line or beyond-designation assumptions to interpret the current route runs.

## Snapshot refresh hand-off

The route builder currently writes its designation and OSM dates as literals. When refreshing either snapshot, update and verify those dates against the source manifests as part of the same change; updating the manifests alone does not update the export dates.
