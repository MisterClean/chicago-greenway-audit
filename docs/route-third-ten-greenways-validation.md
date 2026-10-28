# Third ten-greenway expansion and validation

> **Historical document / checkpoint (October 27, 2026).** The original proposal, results, counts and status below reflect their stated dates and are retained for history; references to a then-current export or working tree do not describe the current build. For current practice and scope, see [methodology](methodology.md), the [route data contract](route-data-contract.md), and [complete inventory validation](complete-greenway-inventory-validation.md). No movements have field approval.

Reviewed October 27, 2026, after committing and pushing the previous batch as `a1d44ad` on `codex/greenway-route-continuity`. Three Terra 6.1 Medium workers researched ten street families in parallel. This batch was committed and pushed as `7054b16`; the figures below describe that checkpoint. See the [complete inventory validation](complete-greenway-inventory-validation.md) for the subsequent expansion.

The export contains **62 street families, 90 route sections, 4,197 movements and 202 directional runs**. Access remains source-inferred or conflicting, with no field approvals. Designated geometry measures 82.33549 miles; included city `mi_ctrline` attributes total 82.33361 miles. These are different length measures. Stops, signals and traffic calming do not sever car access; a driving trace follows the designation through its bends without an off-route detour.

## Scope and remaining inventory

Exactly **17 additional city records** are represented: Albion (3), Birchwood (2), East Lake (1), Jonquil (1), Dearborn (2), Sunnyside (2), Rosehill (1), Charles (2), 98th (2) and 82nd (1). Separate Charles and 98th components produce twelve new route selections. Several streets are links within larger greenway networks, so this is not a claim of ten separate construction projects.

**230 of 258 CDOT Neighborhood Greenway records are represented; 28 records remain, totaling 2.90015 city-recorded miles.** The remaining 26 raw street-name labels include connectors and spelling variants. They are not 26 independently identified projects. Representation includes unresolved geometry, not completed field review.

The population remains exactly CDOT's `displayrou = 'Neighborhood Greenway'` category, excluding other bike-lane and trail types. The live October 27 portal response matched the saved December 2025 extract byte for byte. Its rows lack reliable installation dates. See the [scope review](cdot-inventory-scope-review.md) and [exact remaining inventory](../data/routes/coverage-inventory.json).

## Longest mapped stretches

Distances below follow source-inferred car geometry, including circle arcs. They are rounded to hundredths of a mile. Zero means no allowed run is established in that direction; conflicts and unknown termini are not confirmed maxima.

| Section | Forward | Miles | Reverse | Miles |
| --- | --- | ---: | --- | ---: |
| Albion: Glenwood–Winthrop | East | 0.36 | West | 0.15 |
| Birchwood: Ashland–Eastlake | East | 0.32 | West | 0.07 |
| East Lake: Birchwood–Sheridan | North | 0.00 | South | 0.32 |
| Jonquil: Paulina–Greenview | East | 0.25 | West | 0.25 |
| Dearborn: Goethe–North | North | 0.37 | South | 0.37 |
| Sunnyside: Maplewood–Lincoln | East | 0.38 | West | 0.19 |
| Rosehill: Ravenswood–Ashland | East | 0.25 | West | 0.25 |
| Charles: Vincennes–104th | North | 0.10 | South | 0.10 |
| Charles: 97th–95th | North | 0.20 | South | 0.20 |
| 98th: Loomis–Vincennes | East | 0.26 | West | 0.26 |
| 98th: Avenue L–Avenue J | East | 0.12 | West | 0.00 |
| 82nd: Ashland–Loomis | East | 0.25 | West | 0.00 |

## Matching decisions and limits

**East Lake / Eastlake:** CDOT spells the street `EAST LAKE`; the staged OSM ways are named `North Eastlake Terrace`. An explicit spelling alias in the existing configuration resolves the initially unmatched row. Both original ways run south and retain their motor one-way restrictions and bicycle exceptions. The northern road geometry is clipped to the city endpoint rather than extended to the source node at Sheridan. Raw city records are unchanged.

**98th / Throop:** The western designation follows a short Throop jog. The existing scoped-way mechanism now admits exactly way 1359658130, nodes 1498962104 → 261150726 → 1498962124, bound to city row `row-qwjx_r592.h4qr`. This 10.08-metre slice attaches to both named 98th ways and stays within 1.22 metres of the city line in the source review; the builder and independent audit check the existing five-metre bound at intervals no greater than one metre. Both source-inferred car directions remain allowed. The geographically separate Avenue L–J component retains a reverse-direction conflict on its western block and an eastbound motor restriction on its eastern block.

**Albion parallel lanes:** The railway underpass has two mapped residential arms, both eastbound, with the same endpoints, equivalent relevant motor tags, empty node tags and no matching staged restrictions. They are not an opposing-lane pair. Both remain within eight metres of the city line at one-metre samples. The export follows the shorter arm, way 1178008329, as one mapped car path. Way 458591863 lies closer to the centerline; the designation of either individual lane remains uncertain. This choice does not claim the sole designated lane or the maximum distance among lane alternatives. The arms differ by roughly three metres, share their approach and exit, and the adjacent alley is excluded. Independent checks pin the exact incident-road inventories, source access and selected path so this inference cannot silently survive changed inputs.

**Circles and approach restrictions:** Birchwood and Rosehill use the existing direction-specific circular-junction tracing, retaining each arc's source node order. Rosehill's no-right-turn relation applies to an incoming Ravenswood approach outside the selected Rosehill trace; it does not interrupt travel along Rosehill. On Sunnyside, westbound bicycle contraflow does not permit westbound cars on Western–Lincoln. Blank city motor-direction values elsewhere make no affirmative two-way assertion.

Small unmatched terminals remain visible. Charles's actual endpoint coordinates are trimmed near the city endpoints even though original OSM node IDs remain attached for topology provenance. The two Charles components and two distant 98th components are not joined through other streets.

## Plans, ward communications and evidence

The [north source review](third-north-four-source-review.md), [central source review](third-central-three-source-review.md) and [south source review](third-south-three-source-review.md) preserve exact scopes, searches, dates, retrieval outcomes and source metadata.

- The 47th Ward participatory-budget retrospective, PDF page 2, was downloaded, hashed, rendered and visually inspected. It describes Sunnyside's westbound bicycle lane, Oakley curb extensions and Western bicycle signal; it is a retrospective, not an engineering drawing.
- The first-page image of Alderman Hopkins's June 13, 2024 Dearborn letter was downloaded and visually inspected. Its historical description of two-way traffic and request to remove advisory markings do not establish present conditions or the outcome of that request. The image fingerprint points to its exact media URL, separately from the public post and article.
- The 40th Ward Rosehill project page calls the connector project completed. That is a project-status communication, not verification of each current movement.
- Pages 2–3 of the May 1, 2024 committee agenda were downloaded, hashed and visually inspected. Birchwood eastbound and Eastlake southbound except bicycles appear as direct introductions; an agenda does not prove enactment or installed signs.
- Historical project reporting supplies additional context for Albion/Jonquil, Birchwood/Eastlake, 98th and 82nd. No detailed block-level CDOT engineering sheets were located for these exact scopes, and direct ward communications remain missing for several. The UIC 100th Street concept-plan link still returned HTTP 404 after a public-network retry and is only a search lead. Failed attempts remain catalogued even where a later download succeeded.

The catalog contains **227 observations, 678 citations, 298 source URLs, 49 search-gap groups and 24 research batches**. It preserves exact source and document fingerprint URLs, date meanings, inspected pages, city-row and OSM-way bindings, node sequences and original metadata. All 209 prior observations are unchanged. All 78 prior route geometries, motor decisions, movements and runs are unchanged; Ravenswood and Greenview gain evidence URLs concerning their shared approach/circle geometry.

## Validation

- **102 unit and regression tests passed.** No production routing code needed alteration; this batch uses the existing explicit alias, scoped-way and circular-junction mechanisms.
- Independent geometry and continuity validation passed all **90 sections, 4,197 movements and 202 runs**.
- **350 sampled directional junction decisions passed.** The existing two wholly unmatched sections remain explicit review skips; short Ridgeway/Argyle still has only one eligible distinct node, sampled both ways.
- **203 targeted checks: 198 passed, five review inventories, zero failures.** Thirty-two new checks cover exact city scope, separated components, source direction, circle arcs, clipped geometry, the Throop jog and Albion's parallel-path evidence. An initial audit assumed an internal Throop shape node would be exported as a separate edge; it now checks the entire exact coordinate chain and length independently of subdivision.
- Catalog and coverage freshness, TypeScript and production build passed. The existing bundle-size advisory remains.
- Browser checks covered all twelve new selections and displayed directions, the westbound 98th measurement and reload restoration, and source/catalog links. Remaining distance reaches zero at 100%; route, direction, selected run and measurement survive reload. No browser warnings or errors were recorded.

Export SHA-256: `93223a7dbed005c82a6dd2c6d9ce06ae1d718128cc8fddc8bc7c06eb0d08f51a`. Reproduce using `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`. These checks establish source/software consistency, not current street conditions or a low-stress certification.
