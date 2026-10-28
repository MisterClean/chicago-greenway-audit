# Complete CDOT greenway inventory and validation

Reviewed October 27, 2026, after committing and pushing the preceding ten-family batch as `7054b16` on `codex/greenway-route-continuity`. Three Terra 6.1 Medium workers researched all remaining records in parallel, then reviewed the matching changes, evidence metadata and source audits independently.

**All 258 CDOT Neighborhood Greenway records are now represented: 85.23376 city-recorded miles, with zero inventory records remaining.** The interface contains 85 street families, 114 route sections, 4,323 movements and 233 directional runs. None of these movements is field approved. Inventory coverage includes unresolved geometry and source conflicts; it is not a completed current-condition or cycling-stress audit.

## Exact population and additions

The population is exactly the saved city query `displayrou = 'Neighborhood Greenway'`, excluding every other facility category. The live October 27 response matched the saved extract byte for byte. City data remain reported through December 2025, and the saved OSM extract is effective September 11, 2026. See the [scope review](cdot-inventory-scope-review.md) and [coverage inventory](../data/routes/coverage-inventory.json). City lengths sum to 85.23376 miles; geodesic designation geometry sums to 85.23653 miles. These are different length measures.

This expansion adds the last **28 city records, 2.90015 city miles and 26 raw street-name labels**. Three labels—Sacramento, Richmond and Alley—form Berteau's dogleg. The other 25 records add 25 route selections across 23 street families; Kedvale and Logan each have two components. Joining two earlier Berteau components produces a net increase of 24 sections, from 90 to 114. Street labels and route selections are not independently established construction projects.

The 28 additions are fully enumerated in the [north](remaining-north-source-review.md), [central](remaining-central-source-review.md) and [south](remaining-south-source-review.md) reviews, with exact city-row and OSM-way bindings in the [editable evidence](../data/routes/review-evidence.json). The export contains every source row exactly once; the independent audit rejects missing rows, duplicates and other facility categories.

## Longest mapped car stretches

The table lists the joined Berteau section and all 25 new selections. Distances follow the source-inferred road geometry and are rounded to hundredths of a mile. A zero means no allowed run is established, including unresolved or conflicting cases. Unknown termini are not confirmed maxima. Stops, signals and humps do not break continuity; permitted turns follow the designation without off-route detours.

| Section | Forward | Miles | Reverse | Miles |
| --- | --- | ---: | --- | ---: |
| Berteau: Elston Avenue – California Avenue | Eastbound | 0.24 | Westbound | 1.50 |
| Plymouth: 9th Street – Polk Street | Northbound | 0.06 | Southbound | 0.06 |
| 104th: Prospect Avenue – Charles Street | Eastbound | 0.00 | Westbound | 0.22 |
| Avenue J: 100th Street – 98th Street | Northbound | 0.00 | Southbound | 0.00 |
| Harding: Elston Avenue – Cullom Avenue | Northbound | 0.00 | Southbound | 0.03 |
| 105th: Prospect Avenue – Vincennes Avenue | Eastbound | 0.23 | Westbound | 0.00 |
| 19th: Hamlin Avenue – Ridgeway Avenue | Eastbound | 0.06 | Westbound | 0.00 |
| Logan: Rockwell Street – unresolved endpoint | Eastbound | 0.00 | Westbound | 0.12 |
| Logan: Rockwell Street – Campbell Avenue | Eastbound | 0.13 | Westbound | 0.00 |
| Lakewood: Albion Avenue – North Shore Avenue | Northbound | 0.08 | Southbound | 0.08 |
| Campbell: Logan Boulevard – Logan Boulevard | Northbound | 0.02 | Southbound | 0.00 |
| North Shore: Glenwood Avenue – Lakewood Avenue | Eastbound | 0.00 | Westbound | 0.11 |
| Juneway: Chicago Avenue – Paulina Street | Eastbound | 0.06 | Westbound | 0.00 |
| Farwell: Greenview Avenue – Glenwood Avenue | Eastbound | 0.09 | Westbound | 0.00 |
| Kedvale: Roscoe Street – Milwaukee Avenue | Northbound | 0.04 | Southbound | 0.00 |
| Kedvale: Argyle Street – Carmen Avenue | Northbound | 0.12 | Southbound | 0.12 |
| Eastwood: unresolved endpoint – Clarendon Avenue | Eastbound | 0.10 | Westbound | 0.10 |
| 9th: Plymouth Court – State Street | Eastbound | 0.00 | Westbound | 0.00 |
| Virginia: Leland Avenue – Lawrence Avenue | Northbound | 0.00 | Southbound | 0.15 |
| Paulina: Jonquil Terrace – Juneway Terrace | Northbound | 0.09 | Southbound | 0.09 |
| Douglas: Hamlin Avenue – Ridgeway Avenue | Eastbound | 0.06 | Westbound | 0.00 |
| Montgomery: unresolved endpoint – Rockwell Street | Eastbound | 0.00 | Westbound | 0.08 |
| 100th: Ewing Avenue – Avenue J | Eastbound | 0.00 | Westbound | 0.00 |
| Spaulding: Carmen Avenue – Carmen Avenue | Eastbound | 0.00 | Westbound | 0.03 |
| 97th: Prospect Avenue – Charles Street | Eastbound | 0.08 | Westbound | 0.08 |
| Magnolia: Clybourn Avenue – Dickens Avenue | Northbound | 0.12 | Southbound | 0.00 |

## Matching decisions

**Berteau:** Sacramento way 164646139, alley 32709496 and Richmond 24106579 connect at actual shared source nodes. They join the old Elston–Sacramento and Richmond–California sections into `berteau-1`. Westbound cars follow Richmond north, the alley west and Sacramento south; mapped one-way rules interrupt eastbound travel. The westbound stretch is approximately 1.50 miles. The alley's current access, gates and signs still need verification. The original `berteau-2` is absorbed into this section; `berteau-3` retains its Western–Clark identity through an explicit city-row anchor. All other 88 pre-existing sections retain their geometry and motor decisions.

**Explicit correspondence without permission overrides:** Short city labels differ from mapped road names on Douglas (West 14th Street), Spaulding (curved Carmen), and the southern Kedvale/Roscoe connector. The new `explicit-road-matches.mjs` requires exact city IDs, OSM way IDs and a catalogued explanation. The builder checks every candidate source segment against its own bound city geometry at intervals no greater than one metre, within the existing 18-metre matching tolerance. Deferred and circular matching cannot reintroduce excluded segments. Normal clipping, heading, access and one-way evaluation still apply. Evidence identifies a correspondence; it does not authorize car travel.

Kedvale ways 563963346 and 1449901719 share node 261139126. The apparent 16-metre gap from an initial review was the first actual road leg, not missing topology. The corrected chain is clipped to the designation, retains its one-way permissions and stays within approximately 10.69 metres of the city line. Douglas and Spaulding retain small unresolved terminal remainders.

**9th and 100th:** Both have opposing carriageways at a designation endpoint. The current interior-junction algorithm cannot independently clip those terminal arms. On 100th, the common western approach falls outside the designated geometry; adding it would manufacture an off-route continuation. Both city records remain wholly unknown, with no driving runs, rather than selecting one arm and falsely blocking the opposite direction. Separate terminal-carriageway support remains an implementation review item.

**Nonmotor connections:** Plymouth's cycleway 149987537 remains an unknown motor-correspondence edge; no run crosses it. Eastwood's cycleway and Juneway's footway leave explicit gaps. They do not create through-car paths or inferred bypasses. Source path classifications identify review needs; they are not current field observations.

**Direction conflicts and separate components:** Avenue J's two OSM ways run north while CDOT's motor-direction attribute says south. Both directions remain conflicting and produce no allowed runs. Magnolia retains a reverse-direction conflict. The two Logan rows and Campbell remain separate selections where the city geometry does not support a continuous join; no intervening arterial is added. North Shore's two underpass arms both run west in the snapshot; the selected shorter arm is a source-inferred path, not a declaration that it is the sole designated lane.

## Source catalog and missing documents

The catalog contains **256 observations, 757 citations, 305 distinct source URLs, 52 search-gap groups and 28 research batches**. The new `cdot-complete-designation-inventory` observation binds all 258 rows to the exact filtered city extract, including 43 rows that previously lacked explicit catalog indexing. It establishes designation provenance only. It does not approve motor movements, installation status or low stress.

Each new corridor review retains source node sequences, relevant road tags and restriction searches. City and OSM citations identify the exact extract URLs, retrieval timestamps, date meanings and SHA-256 fingerprints. Checksums cover the saved extracts, not live OSM pages. The eight north citations now explicitly distinguish their September 19 retrieval date from installation. Titles and publishers that differ across batches remain citation-level variants rather than silently selecting one version.

Named-corridor searches for detailed CDOT plans and alderman communications were performed for every remaining scope. The 40th Ward Leland project page, historical CDOT project reporting and other contemporaneous reports provide context, but **no detailed engineering sheets covering these exact final 28 rows were obtained or visually inspected**. Direct ward communications remain missing for several scopes. The indexed UIC 100th Street concept-plan PDF returned HTTP 404 after a public-network retry, so its indexed passage remains only a search lead. Search queries, retrieval failures and limitations remain in the three research batches. Twenty-two scoped contextual citations now index the ward page, historical reporting and unavailable-document leads alongside the exact corridor observations. The December 2019 report records the Polk/Plymouth/9th bicycle connection among that year’s accomplishments, correcting the initial review’s future-program interpretation; it does not establish current motor permission. Earlier inspected plans, ward PDFs and letters remain preserved in the catalog; missing documents in this batch are not replaced with inferred installation claims.

## Validation

- **113 unit and regression tests passed**, including evidence-bound matching, geometry limits, invalid bindings and stable route IDs.
- Independent geometry/continuity verification passed **114 sections, 4,323 movements and 233 runs**.
- **430 directional junction samples passed**, plus one separately labelled source-consistency check for Spaulding's single clipped edge. That edge has no eligible same-way junction, so the alternate check pins its exact source topology, clipping, permissions, absence of mapped restrictions and unresolved remainder.
- **293 targeted checks: 288 passed, five review inventories, zero failures.** The 89 new regional checks and exact inventory-completeness check cover all additions.
- Four wholly unmatched components remain explicit review skips: Wrightwood-2, Hamlin-2, 9th-1 and 100th-1. Ridgeway-3, Harding-1 and Campbell-1 each have only one eligible node, sampled in both directions. These seven sampling limitations remain recorded.
- Evidence and coverage freshness, TypeScript and production build passed. The existing bundle-size advisory remains.
- Browser checks covered all 25 new selections, joined Berteau-1 and preserved Berteau-3. The 100th review panel explicitly states the unmatched-carriageway limitation in both directions. Berteau's measurement reaches zero at 100%; route, run, direction and measurement survive reload. Source and inventory downloads remain linked. No browser warnings or errors were recorded.

Export SHA-256: `c1b8e56e3db3b9cfaf1da7834e46af680a25e763d75f79316421b65a064c4503`. The [audit report](../data/routes/pilot-validation.json) binds its checks to that exact output and the staged source hash. Reproduce with `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`. Software/source consistency is distinct from present-day signs, physical barriers, traffic volume, speed and crossing stress.
