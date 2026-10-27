# Leavitt, Granville and Little Village expansion

Historical checkpoint `21dbe2d`, committed and pushed October 27, 2026. See the [current expansion](route-rockwell-lyndale-wrightwood-validation.md).

Reviewed October 27, 2026, after checkpoint `12bae8c` was committed and pushed. This local expansion adds Leavitt, Granville, 24th, 28th and 30th Streets: six displayed sections and 11.07920 designated miles. The export at this checkpoint covers **27 streets, 43 sections, 2,321 movements and 97 directional runs**, over **43.75722 designated miles**. No movement has a field approval. Car continuity is one input to a cycling-stress assessment, not a stress verdict.

Three Terra 6.1 High agents researched Leavitt, Granville and Little Village in parallel. Follow-up assignments independently reviewed the filter inference and added source-based audit checks. The editable evidence object retains 29 new observations, exact city row bindings, source metadata, research-batch notes and unsuccessful searches.

## Plans and ward communications

| Corridor | Reviewed evidence | Interpretation and limits |
| --- | --- | --- |
| Leavitt | 40th Ward project/completion page; 47th Ward newsletter and visually inspected Montrose/Lincoln graphic; December 2024 photograph and site reporting; 2023 city legislative references; saved OSM topology | The north Leavitt leg ends in a cul-de-sac linked by a raised bikeway. The source-inferred block applies to that through passage. The July 2023 corridor PDF could not be retrieved: its original CDN failed DNS and the canonical ward path returned 404. Bucktown and northern Leavitt remain separate projects. |
| Granville | CDOT February 13, 2025 presentation, pages 24–26 and 34–35 visually inspected via its linked viewer; traffic-impact graphic; 40th Ward project and June/July updates; 50th Ward meeting notice | The detailed exhibit shows westbound cars under the railway and eastbound cars near Broadway. The 40th Ward prose instead calls Broadway–Lakewood westbound. That contradiction remains visible. Its August 2025 completion statement covers its own section; it does not approve every 48th Ward movement. PDF checksum unavailable; viewer inspection is recorded accurately. |
| 24th, 28th, 30th | City/OSM snapshots; 2024 CDOT-attributed 24th reporting; 2023 site visit; historical 22nd Ward proposal reporting; text of CDOT's NACTO overview poster | The broad 24th description must not erase specific endpoint uncertainty. The 28th/30th couplet is westbound/eastbound in the snapshots. Detailed intersection sheets, as-builts and direct corridor-specific ward notices were not located. The inaccessible 31st Street study was not treated as read, and the overview poster is not an intersection drawing. |

See the [Leavitt](leavitt-source-review.md), [Granville](granville-source-review.md) and [Little Village](little-village-source-review.md) source reviews. Failed retrievals and missing documents are retained as search outcomes; no absent document is evidence that a filter exists or does not exist. Dates distinguish proposals, legislative stages, construction reports, photographs and snapshot timestamps.

## Implementation and findings

Leavitt's approximately 53-metre unmatched interval at Montrose remains unmatched geometry, but its through-car access is now blocked in both directions as a scoped source inference. The curated observation cites the ward construction report, graphic, photograph and saved OSM connection. Admission requires both gap boundaries to join through an exact ordered path of source ways, every node to remain within the documented bounds, and the terminal road to end at the mapped turning-circle node. The chosen cycleway must exclude cars in both directions. All incident highways at the cul-de-sac are inspected; an alternative motor exit or unresolved access rejects the inference. The filter never creates a traversable gap or approves surrounding turns. The drawn gap is not a surveyed barrier footprint.

An independent review rejected the initial shared-endpoint-only check: a sideways cycleway alone would not establish a filter. The implementation now validates the full connecting path and alternative exits, with negative tests for disconnected and sideways links, out-of-scope paths and conditional motor exits. Leavitt's northbound stretches are **2.05393 miles** south of the filter and **1.10462 miles** north of it. The southern stretch begins at an unresolved terminal match, so these are not field-verified maxima.

On 30th Street, unnamed residential way 722259223 was excluded by the generic 45-metre unnamed-road limit, creating a false 102-metre gap between Kedzie and Troy. The explicit match admits only nodes `261132026, 11653954542, 6774930747, 11653991255, 261163031`, attached to the existing graph at both ends and within five metres of city row `row-jjg5_pe2y_7ben`, checked at intervals no longer than one metre. A new optional cardinal-axis binding permits city direction comparison only for a consistently aligned, non-reversing slice with the same route axis. It does not suppress the motor conflict: city says eastbound while this OSM way lacks a one-way tag, so reverse remains unknown.

30th now has a **1.62924-mile eastbound** path across its mapped scope; 28th has a **1.63546-mile westbound** path. Their designation endpoints are not road barriers. The 24th snapshot yields a **1.29938-mile eastbound** stretch, with unresolved eastern termination and endpoint direction details. None is a low-stress certification.

Granville's opposing one-way sections split it into eight directional stretches. The Lakewood–Broadway westbound restriction uses the mutually consistent city, OSM and CDOT design inference; its event reason explicitly discloses the ward's opposite prose and requires current sign review. The contradictory source is neither discarded nor generalized to the whole route.

## Catalog and validation

The catalog contains **88 observations, 268 citations and 130 source URLs**, with **31 indexed search-gap groups**. URL identities are not distinct-document counts. Original records, document scopes, date meanings, inspected pages, retrieval methods, available hashes, explicit path bindings and uncertainties remain intact. All **59 earlier evidence records and 37 earlier route objects** were compared structurally with pushed checkpoint `12bae8c` and are unchanged.

The route export SHA-256 is `a604c41abaac977c7548c7315fee0a521f1f00b07741b3fcb17e12251a460fbe`. The audit records this and the staged SQLite hash in `data/routes/pilot-validation.json`.

- **80 unit/regression tests passed.** The former assertion that every gap must be unknown now admits only the specifically evidenced Leavitt filter and continues to prohibit any allowed gap.
- The independent geometry/continuity validator passed all **43 sections, 2,321 movements and 97 runs**. Catalog freshness, TypeScript and the production build passed.
- **172 sampled directional junction decisions passed**, with no skipped sections. **84 targeted checks** comprise 79 passes and five retained review inventories. The added checks cover project separation, one-way changes, Granville underpass/ward discrepancy, Leavitt's blocked passage and the exact unnamed 30th slice.

Desktop browser checks covered all six new selections, Leavitt's physical-filter explanation and source links, Granville's visible source discrepancy, and 30th's continuous eastbound path. The 30th measurement reached zero at its endpoint and restored after reload, along with route, direction, path and map position. The checked tab logged no warnings or errors. These checks verify software behavior, not present street conditions.

Reproduce with `SOURCE_DATE_EPOCH=1793091600 npm run data:routes`, `npm run verify:routes`, `npm run audit:routes`, `npm test` and `npm run build`. The data remain the original December 2025 city snapshot and September 11, 2026 OSM extract; no street observation has silently been promoted to a current field approval.
