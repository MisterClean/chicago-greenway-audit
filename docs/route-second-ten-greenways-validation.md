# Second ten-greenway expansion and validation

> **Historical document / checkpoint (October 27, 2026).** The original proposal, results, counts and status below reflect their stated dates and are retained for history; references to a then-current export or working tree do not describe the current build. For current practice and scope, see [methodology](methodology.md), the [route data contract](route-data-contract.md), and [complete inventory validation](complete-greenway-inventory-validation.md). No movements have field approval.

Reviewed October 27, 2026, after committing and pushing the preceding ten-family expansion as `0eac90c` on `codex/greenway-route-continuity`. Three Terra 6.1 Medium workers researched ten families in parallel across the three available worker slots. This expansion was subsequently committed and pushed as `a1d44ad`. See the [third ten-family expansion](route-third-ten-greenways-validation.md) for the current working-tree results.

The export contains **52 street families, 78 route sections, 4,036 movements and 180 directional runs**. All access remains source-inferred or conflicting, with no field approvals. The designated geometry measures 79.14970 miles; the included city `mi_ctrline` attributes total 79.14805 miles. Stop signs, signals and traffic calming do not break access. Cars follow the designated route, including bends, without an off-route bypass.

## Scope and inventory

This batch adds **27 exact CDOT records**: Ravenswood (6), Greenview (1), Wellington (3), Ridgeway (4), Erie (3), 14th (1), 21st (1), 81st (5), Prospect (2) and Ewing (1). Ravenswood, Ridgeway and 81st have separated designation components, producing fourteen new route selections. Ten street families are not necessarily ten construction projects.

**213 of 258 CDOT Neighborhood Greenway records are represented; 45 records remain, totaling 6.08571 city-recorded miles.** Their 36 raw street-name labels include connectors and spelling variants, not 36 distinct projects. Representation includes unresolved geometry and does not mean field review is complete. The denominator remains exactly `displayrou = 'Neighborhood Greenway'`; other bike-lane and trail categories are excluded. The live October 27 portal response matched the saved December 2025 designation extract byte for byte. See the [scope review](cdot-inventory-scope-review.md) and [remaining inventory](../data/routes/coverage-inventory.json).

## Directional results

Longest source-inferred stretches, rounded to hundredths of a mile. Zero means this export establishes no allowed run in that direction. Unknown terminals and conflicting boundaries are not verified maxima. Driving distances follow the actual directional arcs, so Greenview's northbound road path is slightly longer than its designation centerline.

| Section | Forward | Miles | Reverse | Miles |
| --- | --- | ---: | --- | ---: |
| Ravenswood: School–Roscoe | North | 0.00 | South | 0.12 |
| Ravenswood: Wilson–Peterson | North | 1.77 | South | 1.20 |
| Greenview: Farwell–Jonquil | North | 1.01 | South | 0.93 |
| Wellington: Kimball–Sacramento | East | 0.00 | West | 0.50 |
| Ridgeway: 19th–Douglas | North | 0.54 | South | 0.00 |
| Ridgeway: unresolved Bloomingdale terminal–Cortland | North | 0.09 | South | 0.09 |
| Ridgeway: Argyle–unresolved Carmen terminal | North | 0.12 | South | 0.12 |
| Erie: Damen–Noble | East | 0.76 | West | 0.76 |
| 14th: Kostner–Independence | East | 0.00 | West | 0.75 |
| 21st: Wood–Loomis | East | 0.50 | West | 0.50 |
| 81st: Damen–Racine | East | 0.00 | West | 1.00 |
| 81st: Halsted–Vincennes | East | 0.45 | West | 0.45 |
| Prospect: 105th–97th | North | 1.05 | South | 1.05 |
| Ewing: 118th–114th | North | 0.00 | South | 0.50 |

## Divided roads, circles and unknown connections

The first pass selected a single one-way arm at Greenview/Ridge and the two divided sections near 81st/Union, falsely interrupting the opposite direction. The explicitly evidenced split-carriageway model now accepts two source-ordered chains, rather than requiring one OSM way per arm. The western 81st pair contains six ways (123.68 m combined); the eastern pair contains ten (208.73 m combined); Greenview contains two (112.02 m combined). Each direction retains its original nodes, geometry, length, road tags and movement restrictions.

Admission still requires exact city IDs, way IDs and evidence; the two chains must share opposite terminals, have disjoint interiors, remain within eight metres of the bound city line at sampling intervals no greater than one metre, and attach to existing motor roads at both ends. The explicit split cap increases from 150 to 250 metres to accommodate the eastern 81st pair. This is separate from the unchanged circular-junction and cross-street-slice rules. Configuration does not create permission: the actual source access and restriction rules decide each traversal.

Greenview's six interior branch nodes require exact, evidence-bound incident-road inventories. Reviewed branch ways are excluded even if they already appeared in the named-street matching graph, preventing a shortcut through Sherwin or another Greenview arm. Unknown, missing or extra branches reject the configuration before graph mutation. The helper also rejects a terminal whose only attachment is an excluded branch. Source-order changes and interior restrictions are tested. Four other Greenview junctions use the existing circular-road arc tracing; both directions follow each circle's one-way node order.

Ridgeway's approximately 26-metre terminal near Bloomingdale remains an unknown motor connection. The staged motor road ends at a turning circle connected to a cycleway; that does not establish a motor link to the city terminus. An exact geographic evidence note explains the gap without allowing a run across it. North Lawndale Ridgeway retains the conflict between a city northbound assertion and an OSM way without a one-way tag. Small unmatched terminals remain visible elsewhere.

Ravenswood uses the designated east side of the railway; the parallel west street is excluded. Its School–Roscoe section is separate from Wilson–Peterson. Wellington's Avondale rows are distinct from the 2025–26 Lakeview project. The absent Racine–Halsted greenway record on 81st is not filled with an invented connector. The final eastern 81st row's duplicate Parnell endpoint labels are preserved in source data while its geometry reaches Vincennes. The 14th city label says Hamlin; the matched road boundary is labeled Independence in OSM.

## Plans, ward communications and catalog

The [northern source review](north-four-expansion-source-review.md), [western source review](west-three-expansion-source-review.md) and [southern source review](south-three-expansion-source-review.md) record exact searches, scope, dates, inspected pages and retrieval failures.

- The visually inspected 47th Ward/CDOT Ravenswood redesign drawing shows a northbound motor lane, bicycle contraflow, raised crossings and curb extensions. It is a 2024 proposal, not an as-built drawing. Ward staff's contemporary account and a September 2026 completion report are separate citations. The 40th Ward town-hall PDF's page 24 lists broader resurfacing without a motor layout.
- Greenview's 2016 CDOT/49th Ward proposal and Wellington's 2023 installation account are historical reporting. They do not establish every current traffic sign.
- Visually inspected council records cover a proposed 14th Street motor direction, a proposed 21st Street speed limit and Ridgeway's committee speed-limit action. Legislative material is distinct from an installed traffic treatment or a ward project update.
- The Cook County Lake Calumet study's inspected pages concern nearby bicycle planning and the 118th/Ewing traffic count; they are not detailed Ewing motor-lane engineering plans. Prospect's historical project reporting is separately catalogued.
- Detailed corridor engineering sheets and direct alderman construction updates remain unlocated for several exact scopes. Search attempts and failed retrievals remain explicit; an unsuccessful search is not proof that a document does not exist. These gaps do not become field approvals or inferred motor filters.

The catalog contains **209 observations, 620 citations, 282 source URLs, 46 search-gap groups and 21 research batches**. It preserves source metadata, exact extract/document fingerprint URLs, inspected pages, original observations and batch metadata. New divided-road observations include structured source node sequences and ordered arm bindings. All **178 prior observations and 64 prior route objects remain unchanged**.

## Validation

- **102 unit and regression tests passed.** The new cases cover chained opposing lanes, source order, longer bounded split geometry, exact branch inventories, removal of preexisting branch edges, preserved unrelated roads and attachment rejection without mutation.
- Independent geometry and continuity validation passed all 78 sections, 4,036 movements and 180 runs.
- **302 sampled directional junction decisions passed.** Wrightwood's and Hamlin's wholly unmatched sections remain explicit review skips. Short Ridgeway/Argyle has only one eligible distinct same-way junction, sampled in both directions and explicitly recorded as fewer than two.
- **171 targeted checks: 166 pass, five review inventories, zero failures.** Thirty new checks independently bind the 27 city rows, direction assertions, separate components, exact opposing source chains, branch exclusion, circle arcs and unresolved Ridgeway terminal.
- Catalog and coverage freshness, TypeScript and the production build pass. The existing bundle-size advisory remains.
- Browser checks exercise all fourteen new selections, both directional displays, the corrected Greenview southbound measurement, reload restoration, source explanations and download links. Remaining distance reaches zero at 100%; the selected run and position survive reload. No new browser warnings or errors were recorded.

Route export SHA-256: `1233ac860283e39a8e4ecdf0081bd2acdc1fc60f274b51127b1762607f23e7fc`. The independent audit also records the staged database hash. Reproduce with `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`. These checks establish software/source consistency, not present street conditions or cycling stress.
