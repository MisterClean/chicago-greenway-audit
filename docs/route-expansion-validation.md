# Directional continuity: expanded source validation

The candidate export covers 16 sections on Wood, Berteau, Leland, Dickens, Manor, Kenmore, Glenwood, George, Loomis and 124th Street. It contains 867 movements and 35 runs. **No movement has been field approved.** This audit checks consistency with the local snapshots, not current signs, driving legality, traffic volumes or cycling safety. A permitted junction decision does not prove access to its adjoining edges.

On October 27, 2026 the candidate `public/routes/pilot.json` had SHA-256 `08de358a1a527244cde2649902865511dc16dc72996493fcbc9d2595848a6379`. The audit records that hash and the staged SQLite hash in `data/routes/pilot-validation.json`. Recheck both after any rebuild. The OSM extract is dated September 11, 2026; the Chicago Bike Routes snapshot is current as of December 2025. Live source links can differ from the snapshots.

The independent sample chooses two distinct eligible same-way nodes near the quarter and three-quarter positions of each section and examines both directions: 64 junction decisions, all matching the expected narrow `allowed` movement. Selection excludes missing nodes, relevant node tags, via-node restrictions, ways involved in via-way restrictions, conditional way tags, and junction traversals. It selects without using the output decision. No section was skipped. The audit also records 30 targeted checks: 25 passed and five are inventories requiring review. These counts do not imply whole-route validation.

- Wood's two southbound one-way blocks and Leland's eastbound no-straight relation match their source-scoped export decisions. The [Wood ward update](https://www.the1stward.com/woodst) describes the conversion, while the [Leland ward update](https://40thward.org/project/leland-greenway-2/) describes its specific diverter as anticipated; a broader completion label does not prove installation.
- Kenmore includes two snapshot bollard nodes whose adjacent movement decisions are blocked. Check present openings and signs before asserting physical access. George's matched eastbound edges have blocked reverse decisions in the snapshot; verify current signs.
- Glenwood's two split rings have source-inferred northbound passage and unresolved reverse traversal because the source pieces conflict. A third closed ring has distinct source-referenced arcs in each direction, both source-inferred allowed. The audit checks the stored direction, provenance and distinct arc geometry; field circulation remains unverified.
- Loomis has no interior alignment gap at the 95th Street city-record join; its forward join remains unknown because source attributes conflict. The 124th Street runs end at mapped scope boundaries, not physical barriers. CTA's [2022 EIS appendix](https://www.transitchicago.com/assets/1/6/CTA_RLE_FEIS_20220805_AppH_Transportation_1of2.pdf) identifies a constructed greenway on 124th but does not establish its exact automobile movements.
- Manor's 2016 Wilson diverter was a temporary test. Its current condition needs evidence; the city designation alone does not establish either crossing movement. Further scoped sources and questions are in `data/routes/review-evidence.json`.

Reproduce after staging the source network and building the export:

```sh
node scripts/audit-route-samples.mjs public/routes/pilot.json data/routes/pilot-validation.json data/staging/network.sqlite
```

The output includes the exact input and database hashes, selection, outcomes, source links, review inventories and skips. A changed export or source stage requires rerunning the audit; a successful sample is limited to the sampled junction rules.

## Implementation and browser checks

The expanded implementation passes 61 unit and regression tests, the independent export geometry/continuity validator, TypeScript checking and the production build. Run geometry connects at junction boundaries and uses the selected directional arc's length. An independent review found every exported run's geodesic geometry length within 0.005 metres of its reported length.

Desktop checks on October 27, 2026 confirmed the distinct Glenwood/Elmdale arcs, route switching, both 124th directions, the remaining-distance slider reaching zero at the mapped endpoint, Kenmore bollard source links and selection restoration after reload. A 390-pixel-wide view confirmed the unresolved Glenwood section's summary, empty state and review controls. The checked browser logged no warnings or errors. These checks establish interface and export behavior, not field conditions.
