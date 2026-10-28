# 81st, Prospect and Ewing source review

Reviewed October 27, 2026. The [structured observations](../data/routes/review-evidence.json) bind eight city rows and retain the source metadata and exact search queries. The exact city query is in [sources.json](../data/sources/sources.json), SHA-256 `b26466b5e898bdd32732df9484a5bf5fe59eed4edf2d3e27a6c2fdf07c44dda2`; city data is current through December 2025, not a current installation survey. The BBBike OSM extract effective September 11, 2026 has SHA-256 `f24bf47c661b461bc817e4be127bb1726c82c014054df1f9bc39b1fe8b1c3f8c`. Both snapshots are historical. City `oneway_dir = '-'` is no motor-direction assertion, not evidence of two-way access. Bicycle contraflow is not permission for cars. Signals, stops and speed humps alone do not break a through route.

## 81st Street

Five city rows form two geographically separate components: Damen–Racine and Halsted–Emerald–Union–Parnell, continuing east on the oddly labeled Parnell–Parnell row. Racine–Halsted is not a designated row; do not invent that link. The Parnell–Parnell geometry is an east–west line from approximately (-87.63784, 41.74707) to (-87.63516, 41.74712), not a zero-length segment. Staged residential way 1230678751 is named West 81st Street and connects nodes 261137879 to 261137881 over this row; the street appears as road in the snapshot, not an asserted off-road connector. Its east terminus and access require review. Damen–Racine city direction is west, consistent with the westward OSM oneway ways 1123896995, 703049022, 1265277178 and 479983154. The [2023 Streetsblog field article](https://chi.streetsblog.org/2023/12/05/day-two-of-bike-lane-week-on-streetsblog-chicago-far-southwest-side) describes 81st neighborhood greenway routes generally; it is not a block-level engineering plan or present motor restriction survey.

Union–Parnell includes two separately mapped pairs of one-way carriageways. Source-order traversal and attachment were checked independently in the SQLite snapshot:

- West pair: eastbound nodes 12251419592 → 12251419591 via ways 1323964791, 1323964792, 1323964793 (61.96 m); westbound reverse via 1323964795, 57782135, 1323964796 (61.72 m). Combined length 123.68 m. Maximum vertex distances to city line are 3.45 m and 5.59 m.
- East pair: eastbound nodes 261137887 → 261137881 via ways 1323964788, 1323964787, 1323964786, 1323964789, 1323964790 (104.60 m); westbound reverse via 1323964797, 57700822, 57700825, 57700824, 57700823 (104.13 m). Combined length 208.73 m. Maximum vertex distances are 3.27 m and 5.08 m.

Intervening residential way 1323964794 connects 261137887 to 12251419591 and lacks a motor one-way tag. Interior nodes of both opposed pairs have no other incident OSM highway way, and no restriction relation was found involving the listed ways or their shared endpoints. These are local projected vertex-to-polyline measurements; the two westbound arms exceed five metres and must not be described as satisfying a five-metre condition. Both attachments, mapped direction and geometry support separate candidate arcs, not a surveyed present-day traffic arrangement. Review junction movements and signs.

## Prospect Avenue

The city rows cover 105th–104th and 104th–97th. Both have a dash for motor direction. Staged residential ways 1230717385, 1271022584, 33261964, 24102166 and 1359376588 lack `oneway`; absence is an OSM inference, not verified present permissions. The 105th endpoint coincides approximately with node 261166209; the 97th endpoint lies near node 261211636. Verify exact clipping and intermediate intersections rather than applying the bicycle direction field as a motor rule.

## Ewing Avenue

The city row is 118th–114th and asserts southbound. Staged ways 57184478 (node 261282905 → 261326627) and 1068690874 (261326627 → 440981488) are southbound `oneway=yes`, with `oneway:bicycle=no`; bicycle exceptions do not permit northbound cars. Endpoints and current signage remain unverified. The county's [Lake Calumet Bike Network Study](https://www.cookcountyil.gov/sites/g/files/ywwepo161/files/documents/2024-11/2024%20Lake%20Calumet%20Bike%20Network%20Study.pdf) PDF page 41, visually inspected, reports a traffic count at 118th/Ewing; page 76 describes the recently built 118th sidepath between Avenue O and Burley. That adjacent facility is not the Ewing greenway and does not establish a car restriction or connection. PDF SHA-256 `1f51e2e2f4cc3c67da49d6dde3a6dceddeedaf9e51cd6114a225bc837aa26a84`. Browser retrieval failed with a 400 content-size limit; public download and page renders succeeded.

## Search limitations

Exact queries and failed retrievals are retained in the research JSON. No detailed CDOT corridor engineering sheets or direct alderman project updates were located for these exact three geographies. This is a research gap, not evidence that documents do not exist. The nearby 118th Street sidepath and other Ewing bicycle lanes do not establish greenway coverage or current motor access. No listed observation is field-approved.
