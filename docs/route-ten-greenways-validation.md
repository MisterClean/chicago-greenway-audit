# Ten-greenway expansion and validation

Reviewed October 27, 2026, after committing and pushing Bloomingdale/Hamlin as `9310634` on `codex/greenway-route-continuity`. Three Terra 6.1 Medium workers researched ten street families concurrently within the three available worker slots. This expansion was subsequently committed and pushed as `0eac90c`. See the [next ten-family expansion](route-second-ten-greenways-validation.md) for the current working-tree results.

The export now contains **42 street families, 64 route sections, 3,610 movements and 157 directional runs**. All access is source-inferred or conflicting; none is field approved. Its designation geometry measures **69.96545 miles**. Stops, signals and traffic calming do not break ordinary-car continuity, and a car trace follows the designated route through its bends without taking off-route bypasses.

## Scope and remaining inventory

Exactly **33 additional CDOT records** are represented: Keeler (8), Lavergne (6), Long (4), Menard (2), Kilbourn (2), Avers (2), Central Park (2), Hirsch (2), Le Moyne (3) and Cullom (2). Keeler and Lavergne each require two separate route sections, giving twelve new selections. These are ten street families, not ten independently verified construction projects.

The population remains exactly `displayrou = 'Neighborhood Greenway'` in the CDOT Bike Routes dataset. **186 of 258 records are represented; 72 remain, totaling 15.26896 city-recorded centerline miles.** Remaining records have 46 raw street-name labels, including connectors and spelling variants; this is not a count of distinct greenway projects. Representation includes unresolved geometry and does not mean completed field review. The city's included `mi_ctrline` sum is 69.96480 miles, separate from the measured route geometry.

The live portal response rechecked October 27 is byte-identical to the saved 258-record snapshot. The portal remains dated December 2025 and has no reliable installation-status field. Other bike-lane and trail categories are excluded. See the [scope review](cdot-inventory-scope-review.md) and [generated remaining inventory](../data/routes/coverage-inventory.json).

## Directional results

These are the longest source-inferred stretches in each section, rounded to hundredths of a mile. Unknown endpoints and conflicting boundaries are not confirmed maxima. Zero means no allowed run in that direction is established by this export.

| Section | Forward | Miles | Reverse | Miles |
| --- | --- | ---: | --- | ---: |
| Keeler: 33rd–Harrison | North | 1.26 | South | 2.43 |
| Keeler: Congress–Lake | North | 0.07 | South | 0.53 |
| Lavergne: Harrison–Madison | North | 0.00 | South | 0.51 |
| Lavergne: Madison–Hirsch | North | 0.54 | South | 0.76 |
| Long: Belmont–Irving Park | North | 0.50 | South | 0.50 |
| Menard: Jackson–Lake | North | 0.48 | South | 0.17 |
| Kilbourn: Wrightwood–Addison | North | 0.50 | South | 1.24 |
| Avers: Armitage–Diversey | North | 1.01 | South | 0.12 |
| Central Park: Elston–Carmen | North | 0.91 | South | 1.45 |
| Hirsch: Austin–Lavergne | East | 1.07 | West | 0.00 |
| Le Moyne: Austin–Lavergne | East | 0.57 | West | 1.27 |
| Cullom: Harding–California | East | 1.45 | West | 0.70 |

## Topology corrections and unresolved cases

Lavergne near Kinzie and Menard near Lake each have two short opposing one-way carriageways sharing terminal nodes. Picking the shortest geometric arm and reversing it incorrectly creates a one-way interruption. The builder now admits these pairs only through explicit city-row, OSM-way and evidence bindings. It requires exactly two same-name motor roads, opposite endpoint order, disjoint interiors, existing motor-road attachments at both terminals, no additional interior motor branch, a combined length no greater than 150 metres, and all geometry within eight metres of the bound city rows sampled at intervals no greater than one metre. Original OSM access tags, node restrictions and approach/exit restrictions remain active.

The resulting junction has a distinct geometry and distance in each direction. This does not override the city's cardinal assertion: Menard's southbound carriageway conflicts with the city `N` value, and Lavergne's north endpoint touches a different city direction assertion. Both reverse traversals remain unknown/conflicting, with no reverse run using them. These bounded pairs do not establish a general permission to connect nearby divided roads. Existing five-metre cross-street-slice and eighteen-metre circular-junction rules are unchanged.

Kilbourn and Cullom contain small mapped traffic circles. Both directional paths follow the one-way source node order along different halves of each ring; their approach attachments and actual arc lengths are independently checked. Their approximate maximum vertex offsets are 6.36 and 6.61 metres, within the existing circular-junction corridor, not the separate five-metre rule for cross-street slices.

Long's two one-way blocks point toward Addison. Its city row labeled Eddy–Patterson actually has geometry from Addison to Patterson; the raw record is preserved and geometry controls matching. A short conflicting direction boundary remains unknown. Le Moyne's city dash makes no direction assertion; its westbound OSM one-way remains a source inference, not a source conflict merely because the city value is blank.

Hirsch's roughly 102-metre Leamington–Leclaire break contains a bicycle/foot cycleway with an unresolved eastern attachment. It stays unknown for ordinary cars, with no crossing run. A mapped cycleway alone is not being described as a verified installed physical filter. Menard's approximately 14- and 72-metre breaks near Madison and Keeler's approximately 24-metre Washington break also remain unknown, with exact source-node context and no invented alley or cross-street bypass.

Keeler has no designated Harrison–Congress greenway record across I-290. The nearby bridge's reported protected bike lanes are a different facility category. Lavergne's city components have an approximately 63-metre offset at Madison without an eligible connecting row. Neither gap is silently joined. Small unmatched terminal portions on other routes remain visible.

## Plans, ward communications and evidence catalog

The [Austin source review](austin-four-source-review.md), [northwest source review](northwest-three-source-review.md) and [Keeler/Avers/Central Park source review](keeler-avers-central-source-review.md) retain exact geographic scope, searches, dates, document methods and limitations.

- The CDOT-credited Belmont Cragin proposal was downloaded and visually inspected at PDF page 9, printed page 7. It shows planned Kilbourn network coverage, not detailed motor restrictions or installation proof. The CDOT NACTO poster and historical Streets for Cycling West map were also downloaded and visually inspected as broad planning context.
- The 30th Ward Long page links a July 2025 completion report; it is not a separate engineering drawing. The ward's Kilbourn Belmont–Addison participatory-budget update calls for studies and proposed solutions, so it does not establish installed treatments.
- The June 2024 council agenda contains proposed speed limits and a Cullom/Kimball stop. A later historical field report says the stop was absent. Neither establishes present signs, and a stop would not sever motor continuity in this model.
- A 35th Ward newsletter mirror describes a tentative October 2026 Central Park sewer-work schedule. It is retained as time-limited construction context, not a greenway design or current closure.
- No corridor-specific detailed CDOT engineering sheets were located for these ten families. Direct greenway project communications remain missing for several corridors, including the four Austin families, Avers and Cullom. The 31st Street study and official 2023 cycling-strategy PDF returned HTTP 403 and were not visually reviewed. The study's indexed excerpt is a search lead only. These are documented research gaps, not assertions that the documents do not exist.

The normalized catalog now contains **178 observations, 483 citations, 218 source URLs, 43 search-gap groups and 18 research batches**. It preserves original observations, title/publisher variants, date meanings, inspected pages, exact document or extract fingerprint URLs, research attempts and source bindings. Context-only publications are represented as catalog observations; unavailable PDFs remain explicit failed retrievals. All **138 prior observations and all 52 prior route objects remain unchanged**.

Browser testing exposed missing optional description fields in some new evidence records. Known locations are now filled from their exact city rows, and review requirements are explicitly recorded. The renderer also supplies “unrecorded” labels for genuinely absent metadata rather than throwing during route switching and leaving another route's details visible. Regression tests cover absent fields and every saved record.

## Validation

- **95 unit and regression tests passed**, including bounded split geometry/attachments, motor-tag preservation, directional arms and turn restrictions, and optional evidence rendering.
- Independent route validation passed all **64 sections, 3,610 movements and 157 runs**.
- **248 sampled directional junction decisions passed** across the 62 sections with eligible movements. The two existing evidence-bound wholly unmatched sections remain explicit review skips.
- **141 targeted checks: 136 passed and five review inventories, zero failures.** The new checks cover all 33 city IDs, distinct sections, opposing directions, circle arcs, divided-road pairs, city conflicts and unresolved crossings.
- Catalog and coverage freshness, TypeScript and production build passed. The existing bundle-size advisory remains.

Browser checks exercised all twelve new route selections, direction controls, source explanations and source catalog links. Cullom's eastbound measurement reaches zero at 100% and restores its selected run and position after reload. After the evidence-rendering repair, the repeated route-selection pass produced no new browser warnings or errors. These checks verify software behavior, not present street conditions.

Route export SHA-256: `0bcc1ff74767a2aab8754387b9b0e9b77cd55c2b983470945880995b70e49443`. The audit report also records the staged SQLite hash. Reproduce using `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`.
