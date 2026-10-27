# CDOT scope verification and Bloomingdale / Hamlin expansion

Reviewed October 27, 2026, after committing and pushing checkpoint `6c21e14`. This checkpoint was committed and pushed as `9310634`. See the [ten-greenway expansion](route-ten-greenways-validation.md) for the current export. This checkpoint contains **32 street families, 52 route sections, 2,793 movements and 118 directional runs**. Its designation geometry measures **54.69248 miles**. All access remains source-inferred or conflicting; none is field approved.

## The correct CDOT population

The scope is exactly `displayrou = 'Neighborhood Greenway'` in CDOT's Bike Routes dataset `hvv9-38ut`. The [scope review](cdot-inventory-scope-review.md) traces the definition to CDOT publications, distinguishes neighborhood greenways from the broader low-stress network, and records a new live portal comparison. The **258-row live response was byte-identical** to the saved September 19 response, with SHA-256 `b26466b5e898bdd32732df9484a5bf5fe59eed4edf2d3e27a6c2fdf07c44dda2`. The portal still identifies its data as current through December 2025. It has no installation-date or planned/completed-status field, so designation does not establish present physical conditions.

The previous 118-record remainder was already restricted to neighborhood greenways. It did not include the portal's Protected Bike Lane, Buffered Bike Lane, Bike Lane or Marked Shared Lane categories, or the wider low-stress trail network. CDOT publishes segmented inventory records rather than a reliable table of named projects. Generic labels, spelling variants and short connecting streets remain legitimate catalog records until their geography is reviewed; street-name counts cannot replace project counts.

The compiler now rejects every missing or nonexact `displayrou` category. It validates the whole source population and checks the city snapshot hash before route generation writes anything. The coverage output exposes the eligibility field, exact accepted value and validated source count, while Sources & method states the category explicitly. Tests exercise other bike facilities, proposed labels, case differences and missing values.

## Remaining coverage

The expansion adds **13 city records**: five for Bloomingdale and its two jogs, and eight for Hamlin. Of the 258 eligible records, **153 are represented and 105 remain**, totaling **30.54284 city-recorded centerline miles**. The remaining records have 56 raw street-name labels, not a confirmed count of projects. Representation includes unknown geometry and does not mean completed field review.

The [generated inventory](../data/routes/coverage-inventory.json) retains every remaining row, source metadata, eligibility rule and export hash. It totals the city's `mi_ctrline` attribute, not driving distance or geometry measurements. Included source mileage is 54.69092 miles; the geodesic export measures 54.69248 miles. Source attributes and measured geometry are intentionally reported separately.

## New corridors and evidence

Three Terra 6.1 High agents researched source scope, Bloomingdale and Hamlin in parallel, followed by targeted ward searches and independent source-based audit checks. The [Bloomingdale review](bloomingdale-source-review.md) and [Hamlin review](hamlin-source-review.md) retain exact queries, candidate ways and source limitations.

Bloomingdale follows its five explicit city rows from Narragansett to Laramie, including the `BLOOMINDALE` spelling variant. The Monitor and Central offsets use exact source node slices attached at both ends and within five metres of their city geometry. No direction or turn rule is bypassed. The source-inferred path is approximately **1.56 miles in each direction**, with a small unresolved western terminal match. The one-way street east of Laramie lies outside the selected designation and is excluded.

Hamlin's north and south corridors remain geographically separate. The southbound traces measure approximately **1.98 miles** on South Hamlin and **1.13 miles** on North Hamlin. Short northbound stretches coexist with one-way blocks and unresolved direction boundaries. City direction `-` is not a two-way assertion; missing OSM one-way tags allow only the normal source inference, not current verification.

The city Hamlin row at the Douglas boulevard system is drawn along candidate OSM roads named Douglas and Independence. The candidates extend beyond the city endpoints; exact assignment and attachment remain unresolved. Its approximately **176-metre city line stays a single unknown gap with no car runs**, bound to the precise source row and explanation. No straight crossing or boulevard shortcut is substituted. Other nearby loop arms were researched but remain outside this batch's route scope unless already represented.

No detailed corridor-specific CDOT engineering sheets or direct Bloomingdale/Hamlin alderman project updates were located. Focused historical and ward searches are retained, including failed document downloads. The inspected CDOT-credited Belmont Cragin map does not cover Bloomingdale and is not used to infer its movements. The redirected 31st Street study was inaccessible and was not treated as read. These are explicit research gaps, not assertions that the documents do not exist.

The catalog contains **138 observations, 377 citations, 172 source URLs, 40 search-gap groups and 14 research batches**. It preserves actual retrieval methods, dates with meanings, available hashes, snapshot URLs and original records. All **116 prior observations are unchanged**. Of the earlier 48 route objects, 47 are unchanged; Cortland only gains source links on three existing edges from the adjacent Hamlin research, with no geometry, access or distance change.

## Validation

- **89 unit/regression tests passed.** The new category test rejects facilities outside the requested population.
- Independent geometry and continuity validation passed all **52 sections, 2,793 movements and 118 runs**.
- **200 sampled directional movement decisions passed** across the 50 sections with eligible road movements.
- **113 targeted checks** comprise **108 passes and five review inventories**, with zero failures. Bloomingdale offsets, alias scope, excluded eastern one-way, Hamlin directions and the unresolved boulevard row are checked against city and OSM sources.
- Wrightwood's divided-road component and Hamlin's boulevard jog have no road movement to sample. The audit recognizes them only through complete source-ID binding, an existing evidence record, an identical explanation, a wholly unknown gap and no runs. Unexpected empty sampling still fails.
- Catalog and inventory freshness, TypeScript and the production build passed. The existing bundle-size advisory remains.

Browser checks covered all four new selections, Hamlin’s exact unknown-jog explanation, the CDOT-only scope text and the remaining-inventory link. Bloomingdale’s eastbound measurement reached zero at the endpoint and restored its run, direction, map and 100% position after reload. The preview tab logged no warnings or errors. These verify software behavior, not current street conditions.

The route export SHA-256 is `5e7dcc5dfeac5660bfb8f94464a9d1cc9f11c0cbca58391ddcd73352a986d535`. `data/routes/pilot-validation.json` also records the staged SQLite hash. Reproduce with `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`.
