# Winnemac, Ainslie, Carmen and Argyle expansion

Reviewed October 27, 2026. This batch follows the pushed `a3d4a22` checkpoint and adds eight sections on four streets. The export now covers **18 streets, 30 sections, 1,391 movements and 62 directional runs**, over 27.76398 designated miles. All decisions remain source-inferred or conflicting, with zero field approvals. Continuous car access alone does not establish cycling stress.

Three Terra 6.1 High agents worked in parallel on Winnemac/Ainslie sources, Carmen/Argyle sources and the evidence catalog. Follow-up implementation and review covered explicit route turns, source-catalog integrity and independent source checks. The sources are preserved in `data/routes/review-evidence.json`, with project-specific city row bindings, dates, limitations and research-batch metadata.

## Plans, ward updates and their limits

| Street | Material examined | Consequence and remaining gap |
| --- | --- | --- |
| Winnemac | CDOT Damen–Broadway flyer, both pages visually inspected; Lincoln streetscape board p.3; 40th Ward 2024 project announcement and February 2026 streetscape update | The flyer depicts eastbound cars and bicycle contraflow Clark–Broadway, with construction anticipated in 2025. A removed dedicated Lincoln turn lane is not a prohibition on turns. No detailed Glenwood-jog drawing or full greenway as-built located. |
| Ainslie | CDOT Lincoln board p.3; 40th Ward February, March and June 2026 updates; 47th Ward 2023 budget preview | The westbound-to-southbound left-turn restriction at Western must not become a blanket straight-through closure. The separated Lincoln/Western designation components remain unjoined. The ballot is a proposal, not installation evidence. Full greenway engineering and as-built drawings remain missing. |
| Carmen | Historical 47th Ward July 2021 sewer/restoration notice; signed 39th Ward ordinance and September 2025 committee summary, visually inspected; dated secondary project reporting | Temporary sewer work is not a permanent barrier. A short westbound spur near Spaulding appears beside the designation endpoint and cannot be applied across the whole row. Kedzie–Albany's city/OSM disagreement remains unresolved. No original intersection-scale CDOT design or as-built located. |
| Argyle | Ward-branded CDOT-attributed bridge proposal map, visually inspected; 40th Ward 2026 beacon ballot; 39th Ward-sponsored ordinance and committee summary | A proposal to extend westbound flow across the bridge does not establish installation. Kedvale–Pulaski's westbound car direction is corroborated by city and OSM snapshots. The beacons ballot and speed limit do not establish a car-access interruption. Detailed bridge and greenway engineering drawings remain missing. |

See [Winnemac/Ainslie source review](winnemac-ainslie-source-review.md) and [Carmen/Argyle source review](carmen-argyle-source-review.md) for URLs, exact page references, hashes, geographic limits and search outcomes. The inaccessible CDOT project page and searches that did not locate drawings are recorded; they are not claims that the documents do not exist. No historical plan, legislative action or broad construction update is treated as proof of every current movement.

## Route matching

Winnemac and Carmen each briefly follow Glenwood between offset approaches. Their city geometry explicitly contains these jogs, but the street-name filter previously manufactured gaps of approximately 15 and 12 metres. The configuration now binds the exact OSM way/node slice to the specific city source row. Admission requires the same designation component, contiguous source node order, both endpoints already connected to the route graph, and every segment within five metres of the bound city geometry, sampled at intervals no greater than one metre. Cardinal city one-way assertions on a perpendicular jog are rejected for separate handling. Other named street portions and off-route detours remain excluded.

The original motor tags, intermediate node conditions and approach-to-departure restrictions still determine permission. Exported `matching` provenance and scoped `way_segments` in the evidence catalog retain the exact correspondence. Resolving a geometric false gap is not field verification of car passage.

Winnemac Damen–Broadway now has a 1.01665-mile eastbound inferred path. Carmen Clark–Broadway has 0.44133-mile inferred paths in both directions, each following its Glenwood jog. Winnemac Park, Ainslie's disconnected source sections, and the Argyle riverside endpoint are not bridged by an assumed route. Extents are designated scope, not proof of physical closure beyond the map.

## Evidence catalog

The [catalog contract](evidence-catalog.md) describes the deterministic object in `data/routes/evidence-catalog.json`, also copied to `public/routes/evidence-catalog.json`. It contains **40 observations, 115 citations and 61 source URLs**, with 14 groups of search-gap records. Distinct URLs are catalog identities, not a claim of 61 distinct real-world documents.

Each citation retains its original URL and page fragment, date and date meaning, publisher/title/type when supplied, scope, status, inspected pages, review method and checksum. An extract checksum is explicitly tied to its snapshot URL, not to a live OSM object page. Conflicting dates or document versions remain separate citations; conflicting supplied titles and publishers retain their provenance. Missing metadata is visible, and original records survive normalization. Structural validation detects dropped observations, broken references, invalid dates/hashes/scopes and tampering. The production build rejects a stale catalog.

## Validation

The route export SHA-256 is `1746780475915d7647f6c6151e7fa80a6b54986a1657ab8aa4efbe73788a27e5`. The source audit records this and the staged SQLite hash in `data/routes/pilot-validation.json`. The city rows were last updated December 2025; the saved OSM extract is effective September 11, 2026.

- **72 unit/regression tests passed**, including scoped node slices, mid-path deviations, turn restrictions, metadata conflicts, dates, checksums, lossless evidence and stale-output rejection.
- The independent geometry/continuity validator passed all 30 sections, 1,391 movements and 62 runs; TypeScript checking and production build passed.
- All **120 sampled junction decisions passed**, with no skipped sections. The audit also has **54 targeted checks: 49 passed and five remain review inventories**. Its ordinary-node sample is limited to junction rules, not adjoining edge access or a full-route survey.
- A deliberately altered sampled decision caused the audit to report one failure and exit with status 1. Production data were not changed by this negative test.

Desktop browser review confirmed the continuous Winnemac and Carmen turns, all four new street selections, Carmen westbound measurement reaching zero at its endpoint, geographically scoped source panels, the catalog download link, and date meanings such as PDF creation metadata versus publication. Reloading restored Winnemac's selected path and map position. The checked tab logged no warnings or errors. These checks verify the interface, not current street conditions.

Reproduce with `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, then `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`. Raw source staging is required for route rebuilding and the source audit. Use `npm run verify:evidence` to check catalog freshness without that staging. Git pushes and public-site deployment are separate; this batch does not deploy the site.
