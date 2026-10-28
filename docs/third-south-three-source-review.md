# Charles, 98th and 82nd source review

Reviewed October 27, 2026. The [structured observations](../data/routes/review-evidence.json) contain five city rows, staged way node sequences and exact queries. The Chicago Neighborhood Greenway query snapshot is current through December 2025, SHA-256 `b26466b5e898bdd32732df9484a5bf5fe59eed4edf2d3e27a6c2fdf07c44dda2`. The regional BBBike OSM extract effective September 11, 2026, SHA-256 `f24bf47c661b461bc817e4be127bb1726c82c014054df1f9bc39b1fe8b1c3f8c`, is historical; this hash identifies the extract, not individual live objects. City motor `oneway_dir = '-'` makes no direction assertion. Bicycle-only exceptions are not motor permissions. Stops, signals and humps alone do not break a route. These are connected segments within broader networks; separate city rows do not by themselves establish distinct projects.

## Charles

The 104th–Vincennes row `row-sfkb.g97d.sgdr` corresponds to residential way 146306483, nodes 261186289 to 261186290, without a motor oneway tag. The city's northbound bicycle direction does not establish a motor rule. The exported geometry is clipped on the source way near the city endpoint; the original node ID remains as topology provenance. Check the Vincennes junction.

The separate 97th–95th row `row-xf8g~8ygn.jeka` corresponds to connected ways 490761166, 1337294805 and 1230416810, none with motor oneway tags. In the northbound direction the shared nodes are 261186282 → 10242906107 → 2876584094 → 261186281; the city endpoint falls inside the final way. Exported terminal geometry is clipped near that endpoint, while retaining the source node ID for topology. Traffic signal tags at the 95th junction are not alone a reason to split a through movement. Current signs and junction movements need review.

## 98th

The west component, Loomis–Vincennes (`row-qwjx_r592.h4qr`), contains an offset along Throop. West 98th way 24077508 attaches at node 1498962104 to Throop way 1359658130, which continues via 261150726 to 1498962124, attaching to east 98th way 919663824. All lack motor oneway tags. The 10.08 m Throop way lies at most 1.22 m from the city polyline, sampled at intervals no longer than 1 m using local scaled longitude/latitude coordinates. The 98th ways' maxima were 1.43 m and 3.29 m. No barriers on the selected nodes or restriction relations involving those ways were found in the extract. This is a map inference, not proof of current permissions. A [2021 Streetsblog report](https://chi.streetsblog.org/2021/01/21/2020-was-a-good-year-for-far-south-side-bikeway-installation) describes 2020 greenway markings near Vincennes and a connection between Loomis and the Vincennes bike lane; it does not establish current motor movements.

The geographically separate Avenue L–Avenue J row `row-hhh6-5sg3~9x3s` says eastbound for cars. The eastern mapped block, way 1230684260, is eastbound `oneway=yes` with an opposite-direction bicycle exception. The western block, 582898994, has no motor oneway tag: the differing source detail needs field review, not a presumption of two-way operation. Stop tags and bicycle contraflow do not authorize westbound cars. Check signs on both blocks and at both ends.

## 82nd

Ashland–Loomis row `row-ihqd.w7jk-reas` is eastbound in the city data and staged way 196459411 runs eastbound with `oneway=yes`, nodes 6316989390 to 261240297. [Streetsblog's December 2023 field report](https://chi.streetsblog.org/2023/12/05/day-two-of-bike-lane-week-on-streetsblog-chicago-far-southwest-side) describes an unsignalized Ashland crossing and a connection with an older greenway west of Ashland. This does not establish a present-day turn prohibition. Review the endpoint signs and approach movements.

## Search limitations

Exact queries and retrieval failure are in the research JSON. No detailed CDOT engineering sheets or direct alderman website communication for these exact segments was located. Search indexed a 2023 100th Street concept plan discussing the 2020 Ewing–Avenue J network, but the public PDF returned 404 in both browser retrieval and an escalated curl retry; it was not visually inspected and no inference is based on it. None of these observations is field-approved.

The observations and search metadata are preserved in research batch `third-ten-south-three-2026-10-27` of the authoritative evidence file.
