# Rockwell, Lyndale, Wrightwood and named connectors

Historical checkpoint `6c21e14`, committed and pushed October 27, 2026. See the [current expansion and CDOT scope verification](route-bloomingdale-hamlin-validation.md).

Reviewed October 27, 2026, after committing and pushing checkpoint `21dbe2d`. This expansion adds Rockwell, Lyndale and Wrightwood, plus seven explicitly designated connector records. The export now represents **30 street families, 48 sections, 2,587 movements and 111 directional runs**, over **49.90111 miles of city designation geometry**. No movement is field approved. Representation includes unknown geometry and is not a completed audit or a cycling-stress assessment.

## Remaining inventory

Of the saved city's **258 designation records**, **140 are represented and 118 remain outside the export**. The remaining records sum to **35.33363 city-recorded centerline miles**. They use **61 raw street-name labels**, which are not 61 distinct greenway projects: some labels describe short connecting turns, some contain spelling variants, and one street can contain several geographically separate projects.

The new [coverage inventory](../data/routes/coverage-inventory.json) lists every remaining row and groups them by source name. It counts unique exported city IDs, including aliases and differently named connectors, rather than selecting only familiar street names. City attribute mileage (`mi_ctrline`) totals 85.23376 miles, while the earlier geometry-based inventory measured 85.23654 miles; these are different measures. Neither is drivable mileage. The new export includes 49.90013 city attribute miles; its geodesic designation geometry measures 49.90111 miles.

`npm run data:routes` now generates the inventory alongside the route export. `npm run data:coverage` rebuilds it separately, and `npm run verify:coverage` detects stale outputs without writing. The inventory retains the city source metadata and route-export hash. Missing or unknown city IDs, duplicate source IDs in the city table, invalid mileage and stale outputs fail validation. Production builds require a current inventory. The app links it from Sources & method.

## Research and decisions

Three Terra 6.1 High agents researched the corridors and connector inventory in parallel, with independent follow-up reviews of topology, audit assertions and implementation. The source reviews retain exact searches, inaccessible documents and unresolved questions:

- [Rockwell and Lyndale](rockwell-lyndale-source-review.md): three separate Rockwell corridors remain separate. The Lawrence CDOT presentation was downloaded and its Rockwell intersection plan visually inspected (PDF page 25 / slide 24); the Leland presentation's network graphic was inspected on page 10. Bumpouts and crosswalks do not imply a car diversion. The original 1st Ward newsletter, 40th Ward updates and legislative text supply dated context. Detailed Logan Square/Lyndale and South Rockwell plans were not located.
- [Wrightwood](wrightwood-source-review.md): PDF page 9 of the Belmont Cragin evaluation reproduces a CDOT 2020 conceptual network map. Its schematic Cicero and Kostner jogs were visually inspected, but the map cannot resolve carriageways, legal turns or current construction. Targeted 30th, 31st and 36th Ward searches did not locate a corridor-specific update or detailed engineering sheets. Searches are not evidence that those documents do not exist.
- [Named connectors](connector-inventory-source-review.md): city rows explicitly designate Broadway at Aldine and Roscoe and Sheridan at Berwyn. Earlier reviewed CDOT graphics provide bicycle-project context; motor matching uses the carriageway topology and motor rules separately.

The catalog now contains **116 observations, 328 citations, 158 source URLs and 38 search-gap groups**. It retains exact city IDs, OSM objects, original records, inspected pages, retrieval methods, hashes where available, source dates with their meanings, and 11 research-batch metadata objects. URL counts are not distinct-document counts. All **88 previous evidence records remain structurally unchanged**.

## Matching changes

The street configuration can include exact additional city IDs for cross-street connectors. It never edits the source dataset or fuzzy-matches names. Five exact OSM node slices now connect Aldine/Broadway, Roscoe/Broadway, Berwyn/Sheridan, Rockwell/Fullerton and Lyndale/Western. Each slice must attach to the existing graph at both ends, stay within five metres of its bound city geometry at samples no more than one metre apart, and retain normal motor-direction and movement rules. Unknown route bindings fail rather than silently disappearing.

Aldine's earlier schematic review chord is replaced by the actual designated Broadway row. Roscoe's two Lakeview sections merge through its Broadway designation, and Berwyn's eastern sections merge through Sheridan. This changes the former `roscoe-3` and `berwyn-3` section IDs; old links using those removed IDs cannot identify the old section. The distant Roscoe and Berwyn components remain separate. All **36 route objects outside these three corrected families remain structurally unchanged** from `21dbe2d`.

Rockwell's Logan Square sections carry opposing motor one-way directions on either side of Fullerton. The short designated turn does not remove those directional restrictions. South Rockwell has a source-inferred 1.62959-mile run in each direction across its mapped scope. Lyndale's eastbound run follows the Western jog for 0.52985 miles. These endpoints are scope limits or unresolved connections, not surveyed maximum driving distances.

Wrightwood revealed a more serious ambiguity: between Cicero and Kostner the city line lies near the median, roughly 18–20 metres from either divided carriageway. Connector endpoints do not meet that middle line. The default proximity tolerance initially picked fragments of the southern road, which did not establish that they followed the designated greenway. The final export keeps the entire **0.50181-mile middle component unmatched, with no car runs**. A reviewed unresolved-component binding must match the complete city-row set and a cited evidence record. Partial overlaps, duplicate IDs and missing evidence fail. This mechanism only preserves uncertainty; it cannot grant or block car access. Both offset connectors also remain unknown. West of Cicero, a 2.02534-mile eastbound run is source-inferred; its endpoint does not imply a physical filter.

## Validation

- **88 unit/regression tests passed**, including unique-ID coverage accounting, inventory freshness, exact evidence scope and rejection of partial matching-review bindings.
- The independent geometry and continuity validator passed **48 sections, 2,587 movements and 111 runs**.
- **188 sampled directional movement decisions passed** across the 47 sections with eligible road movements. Wrightwood's fully unmatched section is explicitly retained as a review item, with no movement to sample.
- **97 targeted checks** comprise **92 passes and five review inventories**, with zero failures. They check connectors, opposing directions, retained earlier restrictions and the evidence-bound Wrightwood uncertainty.
- Catalog and inventory freshness, TypeScript and the production build passed. The build retains its existing large-bundle advisory.

Browser checks covered all seven new route selections and the three corrected earlier families. Lyndale’s eastbound measurement reached zero at the endpoint, and route, direction, selected run, map position and 100% measurement restored after reload. Wrightwood displays no established car path and the explicit matching-review reason. Sources & method exposes the catalog and remaining inventory. The checked tab logged no warnings or errors. These are software checks, not street observations.

The route-export SHA-256 is `5b2f1a3a8bffbae4584ae130cbf07adcf664aa1d4fa0aefb486369a49de4c1e6`. `data/routes/pilot-validation.json` binds the checks to the exact export and staged SQLite hashes. Reproduce with `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`. The city and OSM snapshots have not changed; current signs, access and installation details still require direct review.
