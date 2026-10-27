# Aldine, Cortland, Berwyn and Polk expansion

Reviewed October 27, 2026, after checkpoint `975fb1f` was committed and pushed. This local expansion adds seven displayed sections on four streets. The export covers **22 streets, 37 sections, 1,626 movements and 76 directional runs**, over **32.67802 designated miles**. All decisions remain source-inferred or conflicting, with no field approvals. Continuous car access alone does not establish cycling stress.

Three Terra 6.1 High agents researched Aldine/Cortland, Berwyn and Polk in parallel. Follow-up work recovered primary Berwyn graphics, corrected mode-specific direction descriptions, and independently checked source scope and continuity. Observations and research-batch metadata are merged into `data/routes/review-evidence.json`; raw city records are unchanged.

## Sources and remaining gaps

| Street | Material reviewed | Consequence and remaining gap |
| --- | --- | --- |
| Aldine | CDOT 2017 east long plot, visually inspected including the Broadway inset; 44th Ward August 2018 construction update; contemporary reporting | The designated bicycle route follows a northward Broadway jog. The plan and historical installation update do not verify current motor turns. Stops, humps and curb extensions alone do not interrupt through access. |
| Cortland | Contemporary report of the 2016 CDOT/2nd/32nd Ward meeting and 2019 CDOT project reporting; 32nd Ward infrastructure index; Ward 26 direct-introduction committee agenda, PDF p.5 | Damen–Ashland and Hamlin–Ridgeway remain separate projects. Bicycle turn pockets and a proposed 20 mph limit do not establish car restrictions. Detailed original plans, applicable ward project notices and current movement evidence were not located. |
| Berwyn | 48th Ward 2024 project announcement and 2026 outlook; ward-hosted CDOT Sheridan concept graphic; CTA closure PDF p.1; 40th Ward 2025 resurfacing and Ashland signal updates | Sheridan's drawing depicts a protected bicycle connection, not proof of a car connection. CTA's March 31–April 4, 2025 closure is historical. Plans, schedules and resurfacing reports do not establish today's signs. No signed engineering sheet or movement-specific as-built was located; targeted 47th Ward searches found no additional western-segment plan. |
| Polk | Saved city and OSM rows; city 2023 ward-boundary GeoJSON, sampled against the designation | Pulaski–Independence is consistently westbound in the source snapshots, with bicycle contraflow. The corridor crosses Wards 24 and 28. Searches did not locate directly applicable detailed CDOT plans or project communications from either ward. Current signs, barriers and junction movements remain unverified. |

See [Aldine/Cortland](aldine-cortland-source-review.md), [Berwyn](berwyn-source-review.md) and [Polk](polk-source-review.md) source reviews for the exact geographic scope and limitations. The evidence object records source URLs, dates and their meanings, retrieval dates, page references, visual review methods and hashes where available. Berwyn's initially inaccessible graphic and notice were subsequently retrieved; both the failed attempts and successful review are retained. Missing plans are search outcomes, not proof that the documents do not exist.

## Route findings

The city misspells the 1.26713-mile western Berwyn row `BERWN`. An explicit configuration alias includes it without fuzzy name matching or rewriting its identity. Geometry and an OSM West Berwyn Avenue segment support the correspondence. Berwyn's western displayed section extends to Ravenswood and has a **1.47974-mile inferred westbound path**. Several eastbound edges remain conflicting: the coarse city motor field says westbound, while some OSM ways explicitly say two-way and others lack a one-way tag. The two-way bicycle/contraflow fields are compatible with westbound cars and are not themselves the conflict.

Aldine's two designation rows are grouped using a documented review connection bound to both city row IDs and a 45-metre endpoint limit. The approximately 41-metre unmatched Broadway interval includes the schematic connecting chord. The actual connector and its turns remain unknown; no run crosses it. Only the two original city lines contribute designated mileage. Aldine therefore has two inferred eastbound stretches of **0.39553** and **0.23401 miles**, rather than a falsely continuous car path or an unexplained omission of the designated bend.

Cortland's two geographically separate projects remain distinct. Polk has a **1.51162-mile inferred westbound path** and a **1.22119-mile eastbound path** beginning beyond the one-way block and unresolved city-record boundary near Independence. Unknown endpoints are not verified maxima. Berwyn's lakefront endpoint stays unknown; the adjacent cycleway is not admitted as a car connection. The unrepresented Ravenswood–Clark designation gap is catalogued separately without inventing a through route.

## Evidence catalog and validation

The deterministic catalog now contains **59 observations, 175 citations and 86 source URLs**, plus **28 indexed groups of search-gap fields**. URL identities are not counts of distinct real-world documents. Batch-wide search gaps are now indexed with their batch ID and record bindings, as well as preserved in the complete raw input; this keeps Polk's missing-plan review discoverable after integration. Metadata conflicts and unknown values remain explicit.

The route export SHA-256 is `7823a004949e1e2e84073fd370912f5f1e91e4f3e41182a9a26e82f3eacb6ba8`. The audit records this hash and the staged SQLite hash in `data/routes/pilot-validation.json`.

- **75 unit/regression tests passed**, including exact source aliases, bounded evidence-backed review connections, preserved designation geometry and batch-wide search-gap indexing.
- The independent validator passed all **37 sections, 1,626 movements and 76 runs**. TypeScript and the production build passed.
- All **148 sampled directional junction decisions passed**, with no skipped sections. There are **65 targeted checks: 60 passed and five remain review inventories**. New cases include Aldine's unresolved offset, Cortland project separation, BERWN coverage, Berwyn contraflow and lakefront handling, and Polk's one-way block and city-record boundary conflict.

The sampled audit checks eligible ordinary junction rules, not every adjoining edge or current sign. The source snapshots retain their original dates: city data updated December 2025 and OSM effective September 11, 2026.

Desktop browser review covered all seven new route sections, Aldine's Broadway gap explanation and plan links, geographically scoped Cortland and Berwyn evidence panels, the Sheridan concept's date meaning and design status, and the downloadable source catalog. Polk's westbound measurement reached zero at 100% and restored the selected path, measurement and map view after reload. No warnings or errors were logged in the checked tab. These checks validate the interface, not current road conditions. A structural comparison also confirmed that all 30 earlier route objects and all 40 earlier evidence records are unchanged.

Reproduce with `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`. Source staging is required for rebuilding and source auditing; catalog freshness can be checked independently with `npm run verify:evidence`.
