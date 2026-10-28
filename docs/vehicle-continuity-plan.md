# Vehicle continuity along Chicago greenways

> **Historical document / checkpoint (October 27, 2026).** The original proposal, results, counts and status below reflect their stated dates and are retained for history; references to a then-current export or working tree do not describe the current build. For current practice and scope, see [methodology](methodology.md), the [route data contract](route-data-contract.md), and [complete inventory validation](complete-greenway-inventory-validation.md). No movements have field approval.

Research and implementation proposal · October 27, 2026

**Historical implementation update (52-section checkpoint):** The route-based pilot is implemented on `codex/greenway-route-continuity`. See the [validation and plan review at that checkpoint](route-bloomingdale-hamlin-validation.md) for 52 sections on 32 street families, tests and unresolved field review, and the [evidence catalog](evidence-catalog.md) for structured source provenance. The research observations below describe the pre-implementation investigation. Git checkpoints have been pushed; the public site has not been redeployed.

## Decision

Make **directional car paths and the places that interrupt them** the map's main objects. Follow the designated greenway through bends and turns, as confirmed by the user. Build the movement evidence first; calculate distance from the resulting paths afterward.

This revises the September specification's straight-ahead angle policy, its automatic extension beyond the designation, and its collapse of two directions into a single pass/fail score. The local pilot implements this model; it is not a completed Chicago driving audit. The published map and scores have not changed.

Internal road edges are still necessary to represent access changes and intersections. They are implementation details, not the arbitrary GIS fragments the user should have to interpret. Once a route is ordered and its movements classified, finding continuous runs is a linear scan in each direction; no general longest-path search is needed.

## What the tests found

Local source: OSM extract effective **2026-09-11**, identified by the checksum in `data/sources/osm-source.json`; official designation snapshot labeled December 2025. Live OSM links below identify objects, but may differ from the saved snapshot.

| Test | Observation | Consequence |
| --- | --- | --- |
| Existing Chicago calculation | `data/normalized/city/states.ndjson` is empty; all 1,452 published scores are zero/unknown. | The numerical solver is not producing incorrect street results: the street movement layer was never completed. |
| Inventory granularity | 1,452 intervals equal the number of consecutive-coordinate pieces in the source. 154 are under 10 m; median 65.925 m; maximum 2,053.945 m. | A drawing vertex is not a meaningful car-access boundary. |
| Matching by street name and nearest endpoint | 52 intervals have no candidates. Typos `BERWN AVE` and `BLOOMINDALE AVE` cause gaps. Winthrop interval 154 has a candidate only 0.1 m from one endpoint but 1,359.4 m from the other. | Match the whole route to a connected chain; names are supporting evidence, not a requirement. |
| Berteau / Greenview | An unnamed residential circle, [way 1088397391](https://www.openstreetmap.org/way/1088397391), connects the Berteau approaches but is excluded by the name filter. | Include junction connectors. A bend, circle or missing name must not manufacture a break. `junction=circular` without an explicit direction needs review; do not assume roundabout rules. |
| Leland / Western | Two roads share a node, but [relation 20163015](https://www.openstreetmap.org/relation/20163015) prohibits the specific eastbound continuation. | Connectivity must include approach-to-departure rules, not just shared nodes or an intersection-wide open/closed flag. |
| Dickens / Burling / Oz Park | [Way 1237331792](https://www.openstreetmap.org/way/1237331792) has `access=yes` and `motor_vehicle=destination`; unnamed cycleways connect the route through the park. | Motor-specific access overrides generic access. Local access and bicycle continuity do not authorize general through driving. |
| Wood | [Ways 1444797397](https://www.openstreetmap.org/way/1444797397) and [1444797396](https://www.openstreetmap.org/way/1444797396) are southbound for cars and bidirectional for bikes; city attributes agree. | Keep two vehicle directions independent and preserve bike exceptions separately. |
| Barrier search | Only two barrier-tagged nodes occur on the 715 candidate ways. There are 135 candidate ways with motor one-way and bicycle two-way tags. | Searching only for bollards will miss restrictions represented by road layout, cycleway links, access rules and turn relations. |

The source probe also records Manor/Montrose's approach-specific restrictions, Kenmore bollards, and Manor/Wilson's apparently connected source geometry. The latter is a review question, not a claim that an old trial diverter remains installed.

### Prototype and reproducibility

```sh
node scripts/probe-greenway-data.mjs
node scripts/probe-route-movements.mjs
node --import tsx --test web/src/*.test.ts scripts/*.test.mjs
```

- `data/experiments/data-probe.json` contains source statistics and seven inspectable cases with way geometry, node tags and relation members.
- `scripts/route-continuity.mjs` traces explicitly supplied, ordered route decisions. It does **not** match roads or infer legal access.
- Nine new behavioral tests exercise turns on the route, signals/stops, opposite one-way directions, a directional prohibition, unknown access/movements, destination-only exclusion, unchanged results after edge subdivision, and invalid inputs. Together with the existing suite, **20 tests pass**.
- `data/experiments/route-movement-probe.json` records bounded experiments on real OSM objects. These are source-based demonstrations, not reviewed full-corridor mileage.

In the Leland experiment, ignoring the relation joins **70.3924 m** eastward; applying it yields separate **18.0967 m** and **52.2957 m** chains. Reverse travel into the west approach is already prohibited by its motor one-way tag. In the Berteau experiment, adding the omitted circle restores geometric connectivity, with connector arcs of **13.3508 m** and **15.8471 m**. The conservative result leaves circulation unresolved rather than choosing an unverified arc. All outside endpoints in these small extracts are unknown, so none of these numbers is presented as a full driving run.

The purpose of these experiments is to establish the right model and reveal data gaps before building another citywide scoring pipeline. No citywide maximum driving distances are claimed.

## What a continuous car path means

Default profile: an ordinary passenger car making a through trip, without a resident, delivery or emergency exception.

1. Travel advances along the selected greenway route in one direction. Legal turns and bends on that route continue the run.
2. Stop signs, red lights, speed humps, raised crossings and ordinary traffic circles do not end it if the vehicle can legally proceed along the route afterward.
3. A physical filter, one-way reversal, prohibited route movement, or access restriction ends the affected direction's run. Store the reason: a legal restriction is not necessarily a physical obstruction.
4. A car cannot leave the greenway, detour around a restriction and rejoin within the same run. Short roadway links that carry the greenway across a logical intersection are included after explicit mapping.
5. A designation endpoint is labeled **end of mapped greenway**, not “cars blocked.” A source gap is **unknown**, not an endpoint established on the ground.
6. Missing/conditional/conflicting information remains unknown. Connected geometry and absence of a restriction tag are candidate evidence, not field verification.

Define the route at the street-corridor level with explicit correspondence to motor carriageways and bike-only connectors. A protected bike lane beside a car road does not close the car road. A bike-only bridge or park path with no corresponding motor continuation does interrupt the car path. Both cases need correct alignment before evaluating access.

Report a selected path's full continuous length and, when the user selects a location and direction, the remaining distance from that point. Label these separately. Both distances are clipped to the selected greenway route by default. An optional future context layer may show driving beyond the designation without mixing that distance into the main measure.

This measures **continuous driving access / opportunity for through traffic**. It does not prove traffic volume or cycling stress. A later stress assessment can add speed, volume, crossings and observed behavior; [NACTO's bicycle-boulevard guidance](https://nacto.org/publication/urban-bikeway-design-guide/designing-bikeways-for-all-ages-and-abilities/bikeways-on-low-speed-low-volume-streets/bike-boulevards/) evaluates speeds and volumes as well as design.

## Implementation architecture

### 1. Assemble routes before evaluating cars

Keep the official source records and IDs as designation evidence. Assemble adjacent records into ordered route paths using geometry, endpoints, project maps and explicit junction connections. Do not merge every street sharing a name, infer a route through every nearby crossing, or assume city source coordinate order is vehicle direction.

Start with hand-reviewed route assemblies for **Wood, Berteau, Leland and Dickens**, including their difficult intersections. These cases expose different failures immediately. Do not start with all 1,452 inventory intervals.

Match each assembled route to a connected sequence of OSM road/path edges. Generate candidates spatially; compare route coverage, lateral separation, orientation, topology and grade. A source line may match many ways. Use a local metric projection for matching and WGS84 geodesic lengths for reporting. Keep all highway classes needed for bike connectors so a car prohibition does not appear as missing geometry.

Use names as a tie-breaker and emit aliases/mismatches for review. Explicitly resolve parallel bike paths, divided roads, unnamed junction connectors and grade-separated crossings. Require full accounted-for route coverage, including separately marked unmatched intervals; never silently snap a gap.

Branches become explicitly identified route alternatives. Loops retain ordered route occurrences and are traversed at most once; repeated laps cannot increase a distance. Ambiguous route assembly stops automatic acceptance. A general graph of all possible greenway transfers is outside this first implementation.

### 2. Build a small movement model around each junction

Reuse `data/staging/network.sqlite` and its spatial index. Preserve OSM node identity; geometry intersections alone do not create connections. Fetch neighboring ways and complete restriction members, including unnamed connectors and via ways, rather than relying only on the existing candidate exports.

Internally split at actual junctions, barrier/access nodes, changes in access/direction, and route entry/exit locations. Leave ordinary shape vertices inside the edge geometry.

For each incoming route approach, identify the outgoing approach carrying the route onward. At a divided intersection, dogleg or circle this can be a short chain. Search only within the reviewed junction footprint and route alignment. Do not select an arbitrary car-router detour simply because it connects the endpoints. Connector distance is included exactly once.

Evaluate the actual movement, independent of its turn angle:

- Passenger-car access with mode-specific precedence, directional tags, and highway defaults; preserve local/destination access as a separate attribute.
- `oneway=yes`, `oneway=-1`, explicit exceptions and conditional direction; bicycle exceptions never create a car direction.
- Node barriers and their mode-specific access, plus road/path topology and physical separation.
- `no_*` and `only_*` relations for the relevant vehicle and approach. An `only_right_turn` also prohibits other departures; `no_straight_on` does not prohibit a greenway's legal right turn.
- Via-way restrictions as path/history constraints, not just single-node flags. Implement supported forms with traversal state; mark all affected unresolved movements unknown until unsupported forms are handled.
- Time-conditional access/restrictions: retain the condition; evaluate an explicit selected time/profile later or keep unknown for the default timeless analysis.

A basic routing engine can be a secondary diagnostic comparison. It is not the ground truth: ordinary routing can legally leave the greenway, choose a bypass, or share the same missing OSM restriction.

### 3. Keep decisions and evidence separate

Suggested durable records:

| Record | Required content |
| --- | --- |
| Route | Stable ID, ordered edge occurrences/linear positions, designation source IDs, reviewed connector roles, explicit route boundaries and alternatives |
| Road edge | Node IDs, geometry, geodesic length, source way/portion, directional motor access, bicycle access, raw tags |
| Movement | Incoming edge, junction/connector path, outgoing edge, direction, `allowed / blocked / unknown`, rule/reason, physical-vs-legal status |
| Evidence | Source URL/ID, source/capture date, observation date, effective period when known, reviewer, method, conflict notes |
| Run | Route/direction, ordered edges and connector geometry, length, start/end reasons, evidence status, completeness within route |

Use **source-inferred / reviewed / conflicting** as an evidence dimension separate from allowed/blocked/unknown. This allows an honest provisional direction map before every case is surveyed. An empty evidence list must not become “reviewed.” Stable identifiers should not be the current sort-dependent `sid` alone. Retain snapshot hashes; preserve per-object versions/timestamps when rebuilding the OSM stage.

No inferred permission silently overrides newer physical or official evidence. Preserve both the old assertion and the reason it was superseded. Plans, completion notices and dated observations have different meanings; an anticipated installation date alone does not establish installation.

### 4. Trace and measure

For an ordered route, scan forward and reverse independently. Append an allowed edge only when the required connecting movement is allowed. Stop at blocked or unknown access/movement. Restart afterward where vehicle access resumes.

Consecutive allowed pieces form a directional run. An unknown boundary produces an incomplete confirmed chain, not a proven short maximum. A scope endpoint can make a length complete **within the designated route**, but does not establish a forced vehicle exit from the underlying street. Keep those meanings separate in the output.

The experiment already implements this scan over explicit decisions. Production work is mainly the route matching, movement evaluation and evidence workflow. Keep the existing Rust solver as a historical/reference component; adapting it is optional once the revised contract is stable. Porting this linear scan for speed is not the next priority.

### 5. Map paths, arrows and interruptions

Reuse MapLibre and the static publication machinery. Introduce a versioned route/run/event export instead of forcing the new meanings into old `lb_mm/exact` pass/fail fields.

At the city overview, show greenway routes and review coverage. On selection, show two directional traces with arrowheads, continuous-run lengths, and labeled interruption markers. Use distinct symbols for physical filters, legal restrictions, one-way changes, route ends and unknowns. Unknown links are dashed; do not draw all uncertainty as a blockage.

The detail panel answers: **Can a car continue here? In which direction? How far along this greenway? What ends the path? How do we know?** Show both directional outcomes, their source dates, and the actual highlighted route. Defer a threshold slider until these answers are correct. Avoid a green “low stress” badge based only on continuity.

## Street-level review: tested workflow

Manual Google Maps URL launches were tested in the browser on October 27, 2026. No API key or bulk image extraction was needed; [Google documents this URL mechanism](https://developers.google.com/maps/documentation/urls/get-started).

| Trial | Result | Workflow lesson |
| --- | --- | --- |
| Exact Dickens / Lincoln Park West viewpoint | “No Street View imagery available here.” | A failed coordinate lookup does not prove absent area coverage. |
| About 20 m south on Lincoln Park West | Loaded imagery dated **August 2026**. | Generate approach viewpoints as well as a junction center. |
| Dickens Drive just east of the junction | Loaded another **August 2026** panorama. | Different views help distinguish the roadway from its parallel bike facility. |
| West Leland approach to Western | Loaded imagery dated **June 2019**. | A successfully loaded panorama may be too old to assess a 2025 project. |
| Western approach just south of Leland | Loaded imagery dated **May 2025**. | Moving to the arterial found newer imagery, but this view still precedes the project's later construction update. |

These observations establish workflow feasibility, not a complete legal access audit. No imagery was copied into the repository or used to generate accepted movement records. Useful review links: [Dickens approach](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=41.9200%2C-87.6364&heading=0&pitch=0&fov=80), [Dickens Drive](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=41.920185%2C-87.63615&heading=90&pitch=0&fov=80), [Leland approach](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=41.9667828%2C-87.6890653&heading=90&pitch=0&fov=80). Coordinate links may select different imagery in the future.

Queue review work by **movement**, with the exact incoming/outgoing approaches. Inspect both relevant approaches and departure, signage, usable openings and applicable dates. If the view predates construction, is obscured, or cannot establish the movement, use another dated source or field inspection. Lack of a visible sign is not affirmative permission.

Use official records and own/appropriately licensed field observations for durable movement assertions. Keep Google as a separate manual viewer initially. Any future API integration needs its own licensing design: [Maps Platform terms](https://cloud.google.com/maps-platform/terms) restrict extraction/derived content and some combinations with non-Google maps; these API terms should not be conflated with a blanket prohibition on ordinary manual viewing. The [metadata API](https://developers.google.com/maps/documentation/streetview/metadata) requires a key and can report capture date/availability, but it cannot determine whether a movement is legal.

## Pilot sequence and release gates

1. **Route assembly and directional preview.** Hand-check the four pilot routes and every connector. Compare OSM motor directions with city `oneway_dir`, independently of `br_oneway`, `br_ow_dir` and `contraflow`. Deliver a route map with provisional direction arrows and an explicit gap list.
2. **Movement review.** Cover every junction/barrier in those routes, with a stratified set of at least 30 directional decisions including ordinary crossings, one-way changes, a circle, a park connection, destination access, a divided crossing and a changed project. Review uninterrupted interiors as well as endpoints: a missed interior filter can invent a long run.
3. **Run overlay.** Connect only decisions justified at the displayed evidence level. Show source-inferred results separately from reviewed results. Compare every pilot run to a manual route trace, both directions, including its full geometry and distance.
4. **Hold-out validation and expansion.** Reserve examples not used to tune matching. Require zero false-open and zero false-closed decisions on reviewed pilot cases, no silent unmatched intervals, and full explanations for unresolved cases. Report coverage and disagreements. Expand geographically only after this gate passes; all unresolved citywide coverage stays visible.

Acceptance checks must also include overpasses, parallel cycleways, reversed source geometry, `oneway=-1`, only-turn restrictions, via-way/conditional unknowns, a greenway right turn, an unauthorized off-route bypass, loops without repeated laps, and route boundaries that are not physical closures. Add integration tests as these interpreters are implemented; the current nine prototype tests do not validate them all.

The next useful deliverable is **one fully inspectable pilot map with arrows, actual interruption reasons and dated evidence**, then the remaining pilot routes. Choose Wood first for direction changes, followed immediately by Leland and Berteau to exercise movements and connectors. Dickens tests park continuity and stale/parallel-infrastructure evidence. Build citywide automation from those reviewed examples.

## Primary-source checks affecting the pilot

- [1st Ward Wood project](https://www.the1stward.com/woodst): Augusta–Cortez and Division–Crystal southbound except bicycles; Cortez–Division remains two-way. The page's striping date is anticipated, not by itself proof of completion. The saved city and OSM directions agree with this design.
- [40th Ward Leland project](https://40thward.org/project/leland-greenway-2/): currently labeled **Completed**, with a right-turn-only diverter in the described scope. Its older September 2025 update still uses future tense. Verify the exact affected approaches rather than deriving all movement rules from either sentence alone.
- [CMAP Grand Avenue Corridor Plan, printed p. 34 / PDF p. 37](https://cmap.illinois.gov/wp-content/uploads/GrandAvenueCorridorPlan.pdf): downloaded PDF text describes the Dickens access closure as reopened and attributes the case study to the City of Chicago. This makes Dickens a useful regression case against stale plans and old imagery. No movement decision relies on this passage alone.
