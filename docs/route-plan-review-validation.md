# Directional continuity: School, Roscoe, Winthrop and Ardmore

> **Historical document / checkpoint (October 27, 2026).** The original proposal, results, counts and status below reflect their stated dates and are retained for history; references to a then-current export or working tree do not describe the current build. For current practice and scope, see [methodology](methodology.md), the [route data contract](route-data-contract.md), and [complete inventory validation](complete-greenway-inventory-validation.md). No movements have field approval.

Historical checkpoint, committed as `a3d4a22`. The [next expansion and evidence catalog](route-north-validation.md) supersedes the counts and export hash below. `data/routes/pilot-validation.json` now records that newer export.

Reviewed October 27, 2026. This batch adds four streets and six designation sections to the ten-street checkpoint `b1866c8`. The current export contains **22 sections, 1,206 movements and 47 directional runs**, covering 23.88479 designated miles. All movement evidence remains source-inferred or conflicting; there are no field approvals. These are potential through-car paths, not cycling-stress scores or verified driving instructions.

## CDOT plans and alderman communications

Project boundaries matter: Roscoe's Northwest Side project is separate from Lakeview. Each new evidence record is bound to explicit city row IDs. The app shows each source's geographic scope, date and status, and does not display Lakeview plans as support for Northwest Roscoe.

| Project scope | Design material examined | Ward communication examined | Limits and implications |
| --- | --- | --- | --- |
| School, Ravenswood–Clark | CDOT November 2017 presentation and Lincoln–Clark long plot; drawing visually inspected | 44th Ward August 20, 2018 construction update | Drawings begin at Lincoln. Raised crossings, humps and curb extensions do not automatically interrupt cars. Some OSM ways lack the city's eastbound one-way rule, so reverse access remains conflicting. |
| Lakeview Roscoe, Damen–Lake Shore Drive | CDOT November 2017 presentation and both long plots; drawings visually inspected | Same scoped 44th Ward update | Broadway has an offset with a raised contraflow bicycle connector. The two designation components remain separate; the bike connection does not establish a motor path. Drawing coverage does not extend west of Lincoln. |
| Northwest Roscoe, Narragansett–Kedvale | CDOT 2020 network map reproduced in the 2023 Belmont Cragin report; council one-way introductions, July 2021 | CDOT's August 2021 account of collaboration with the three wards; ward-site searches | No detailed intersection drawings or scoped original ward construction notice located. A network map and legislative referrals do not establish installed movements. Reverse circulation at Keeler conflicts in the OSM snapshot. |
| Winthrop, Leland–Sheridan | CDOT 2014 project report; 2024 ward-hosted drawing crop inspected | 48th Ward 2024 wayfinding updates, May/June 2026 Goudy gate notices and October 2026 safety summary | The drawing crop lacks legible street names. No attributable intersection-scale plan located. School gates reportedly interrupt Winthrop when closed; schedule, exact layout and current access remain unknown. |
| Ardmore, Broadway–Lakefront | CDOT 2014 project report and same unattributed drawing crop | 48th Ward September 2024 construction and October 2026 safety updates | The 2024 CTA closure was temporary. No attributable detailed intersection plan located. Bicycle contraflow does not permit westbound cars; the trail-side unmatched geometry remains unknown. |

The detailed source notes preserve URLs, PDF page references, visual review, SHA-256 hashes and unresolved questions: [School and Lakeview Roscoe](school-roscoe-source-review.md), [Northwest Roscoe](roscoe-northwest-source-review.md), and [Winthrop and Ardmore](winthrop-ardmore-source-review.md). Structured records are in `data/routes/review-evidence.json`. Searches that did not locate a drawing are recorded as review gaps, not proof that drawings do not exist. Plans, construction notices and dated observations do not by themselves establish current signs or installation.

## What changed in the map

- Roscoe/Keeler's unnamed tertiary circle now reaches the bounded junction matcher. Its approximately ten-metre false gap is removed. The matcher still requires topology, corridor and footprint checks, and retains conflicting reverse circulation; ordinary unnamed tertiary streets cannot become off-route bypasses.
- The approximately 83-metre unmatched Winthrop passage near Goudy has ward gate context and direct source links on its adjacent review points. Geographic and source-record bounds prevent that context from leaking onto Winthrop's separate endpoint gap. Access stays unknown in both directions, and the two southbound runs remain separate. The unmatched geometry is not a survey of gate locations.
- Lakeview Roscoe remains split at Broadway. Ardmore's approximately 59-metre eastern gap is not bridged through the Lakefront Trail. School's unresolved reverse-direction source conflicts stay visible.
- Source details show the applicable geographic scope. A street-name match alone no longer associates the new project records with a distant section of the same street.

## Reproducible checks

The audited `public/routes/pilot.json` SHA-256 is `a6d5868ee5ada93811c4e46aca6e0897fde3dec8b005b65e98a5428d56ea85f7`. The OSM extract is dated September 11, 2026 and the city designation snapshot December 2025. `data/routes/pilot-validation.json` records the export and staged-database hashes; rerun it after rebuilding.

The source audit selects two eligible same-way junction nodes near each section's quartiles and examines both directions, independently of the observed outcome. All **88 sampled decisions passed**, with no skipped sections. It also records **44 targeted checks: 39 passed and five are inventories requiring review**. Samples exclude restricted, conditional and junction-traversal cases and test movement rules separately from adjoining edge access. This is snapshot consistency testing, not whole-route or present-day verification.

New targeted checks cover Broadway's separate city endpoints, Keeler's actual source-way circulation, both Winthrop gaps and gate-context scope, Ardmore's cycleway/contraflow distinction, and School's missing OSM one-way tags versus city attributes. The implementation passes 64 unit/regression tests, the geometry and continuity validator, TypeScript checking and the production build.

Desktop browser checks confirmed all four new route selections, separate Northwest/Lakeview Roscoe source panels, readable drawing scope and status, the Winthrop gate notice and ward links at the affected review point, and School's remaining-distance control reaching zero at its mapped endpoint. Restoring the Winthrop review URL retained the selected event and map position. The checked tab logged no warnings or errors. These are interface checks, not street observations.

```sh
SOURCE_DATE_EPOCH=1793091600 npm run data:routes
npm run verify:routes
npm run audit:routes
npm test
npm run build
```

The build requires the staged source network; the committed static export can be run without it. Public website deployment is separate from Git pushes. Current field observations, original missing plans and attributable completion records remain necessary before approving unresolved movements.
