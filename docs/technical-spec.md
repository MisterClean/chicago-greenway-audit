# Chicago Greenway Straight-Through Driving Map

Technical specification · version 1.0 · September 19, 2026

Status: proposed implementation, ready for a Ward 35 pilot. This document specifies the map; it does not report calculated Chicago driving distances or measured performance.

## 1. Recommendation

**Calculate each greenway segment’s longest uninterrupted driving distance once, offline. When the user changes X, compare the stored distance with X.** Changing X must not rebuild the road network, search for paths, or split geometry again.

Use a Rust command-line program for preprocessing, compact arrays for the calculation, and a TypeScript/MapLibre map served as static files. Send only greenway geometry, small numeric attributes, and a compact summary index to the browser. Do not send the road graph.

Rust is a reasonable choice for controlling preprocessing memory. The larger savings come from the architecture and data representation. There is no need for Rust/WebAssembly in the browser, a routing API, or an always-running calculation server for this version.

| Component | Proposed implementation | Reason |
| --- | --- | --- |
| Source preparation | Streaming imports; disk-backed staging and spatial index | Avoid retaining entire source files and coordinate objects in RAM |
| Distance calculation | Rust CLI; indexed arrays | Predictable storage and linear-time graph traversal |
| Map | TypeScript + MapLibre GL JS | Display precomputed attributes and respond to X |
| Geometry delivery | Vector tiles in PMTiles | Fetch spatial subsets instead of loading all geometry |
| Summary numbers | Sorted numeric distributions with cumulative lengths | Update totals with binary searches |
| Hosting | Static assets on a host supporting HTTP range requests | No application server required |

PMTiles supports accessing tiles within an archive through HTTP range requests and has a documented MapLibre integration. Its caches still consume memory and need bounds; a single archive does not mean the whole file should be downloaded. [PMTiles concepts](https://docs.protomaps.com/pmtiles/), [MapLibre integration](https://docs.protomaps.com/pmtiles/maplibre)

## 2. Product contract

The map answers one question:

> Does this designated greenway segment belong to a permitted, straight-through driving run at least X miles long?

A **greenway segment** is an atomic portion of a designated greenway, split where its driving conditions change. A **driving run** includes the whole uninterrupted corridor containing that segment, including portions outside the greenway designation.

For a fully resolved segment `s`:

```text
D(s) = longest permitted straight-through driving run containing s
       across all permitted motor-vehicle directions

FAIL / red:    D(s) >= X
PASS / green:  D(s) < X
```

Equality fails. Use this convention consistently in the map, summaries, tests, and explanatory text. Lowering X can only remove segments from the passing set; increasing X can only add them.

The measured distance is the length along the street, not straight-line distance between endpoints. It is the full run containing a segment, not the remaining distance from that segment to the next turn. A block near the end of a two-mile run still receives a two-mile score.

The main label is **“Passes the straight-through driving test.”** Explain once that this is an indicator of potential cut-through access, not a measurement of traffic volume or a guarantee of cycling comfort.

Scope excludes routes that turn onto other streets, bypasses, travel-time estimates, traffic counts, crash modeling, and a composite stress score. Ward filtering, if added later, must not change driving distances.

## 3. What counts as continuing straight

“Straight” means continuing ahead through the street corridor, allowing ordinary gentle curvature. It does not mean maintaining one exact compass bearing. Crossing a major road does not end a run when straight-through travel is permitted.

| Situation | Required behavior |
| --- | --- |
| Ordinary intersection with legal straight movement | Continue |
| Stop sign, signal, speed hump, raised crossing, or narrowing | Continue if a car can proceed ahead |
| Street name changes but alignment continues | Continue; names do not determine connectivity |
| Same street name requires a left or right turn | End the run |
| T-junction with no straight exit | End the run |
| Closure, bollards, or median blocking straight vehicle passage | End the affected direction’s run |
| Mandatory left/right turn or prohibited straight movement | End the affected run |
| One-way direction changes | Respect permitted vehicle movements; never assume the reverse direction is open |
| Bicycle contraflow | Does not authorize motor vehicles in that direction |
| Greenway designation or ward boundary ends | Continue tracing the underlying street |
| Import boundary or unexplained topology gap | Unresolved endpoint; never treat as a real forced turn |
| Traffic circle, offset junction, divided-road crossing, or ambiguous fork | Review the logical movement before assigning an exact score |

Use the normal passenger-car legal access profile. Emergency-only exceptions do not make a corridor generally drivable. Signed restrictions count under this profile; the map does not model violations. Conditional restrictions and unresolved access exceptions require review before the affected segment can pass.

OSM encodes vehicle direction, access, and turn restrictions separately. Import all relevant information; do not infer the complete movement rules from road geometry or a single one-way attribute. [OSM one-way documentation](https://wiki.openstreetmap.org/wiki/Key:oneway), [access documentation](https://wiki.openstreetmap.org/wiki/Key:access), [turn restrictions](https://wiki.openstreetmap.org/wiki/Relation:restriction)

### 3.1 Default geometric rule

For an ordinary, normalized junction:

1. Calculate incoming and outgoing travel headings using approximately 20 metres of geometry outside the junction. Use a local projected coordinate system for heading calculations. Use the available shorter approach only when it provides a reliable heading; otherwise mark it unresolved.
2. Compare all physically connected forward approaches, excluding a U-turn onto the same edge. Normalize the heading difference to 0–180 degrees.
3. If exactly one candidate is within 30 degrees of continuing ahead, and other candidates are at least 60 degrees away, treat it as the geometric straight continuation.
4. Apply direction, access, barrier, and turn rules to that candidate. If it is known to be prohibited, the run ends. Do not choose a turning alternative simply because the straight option is prohibited.
5. If every forward candidate is at least 60 degrees away, classify the junction as a geometric end to straight travel, provided the junction is complete and ordinary.
6. All other cases are unresolved until reviewed. The 30–60 degree interval is deliberate uncertainty, not a hidden forced-turn classification.

These angle thresholds are proposed implementation defaults, not safety standards. Calibrate them using the pilot, record them in the build manifest, and keep them fixed while users change X. A changed angle policy requires rebuilding scores.

Normalize short intersection connector pieces into logical movements before measuring angles. A small traffic circle or a stagger in intersection geometry must not automatically create a forced turn. Review sharp bends within a road edge and split at confirmed forced direction changes; an OSM way boundary is not a substitute for this check. Detect candidate bends with local headings sampled along the polyline, then review them in the pilot. Unresolved bends remain unknown.

Store reviewed movement overrides with source references and reasons. They are input data, not scattered special cases in the solver.

## 4. Data inputs and source management

| Input | Use | Important constraint |
| --- | --- | --- |
| Official Chicago Bike Routes geometry | Identify designated neighborhood greenways | Preserve source IDs; separate existing and proposed facilities |
| Newer maps and completed project records | Reconcile omissions and updates | A newer webpage date does not prove newer underlying geometry |
| Dated local OSM extract or equivalent street network | Street topology, vehicle direction, barriers, restrictions | Retain complete relevant ways and relations |
| Reviewed overrides | Correct forced-turn locations, access, junction interpretation, and matching | Version with evidence date and reviewer note |

The earlier research found the official Bike Routes dataset labeled current as of December 2025 and the CNT map labeled August 2026. Recheck those dates when the implementation begins. The ChiWhoBike application uses a December 2025 bike-route snapshot and classifies greenways as calm by facility category. Reuse its inventory as a comparison source, not its calm classification as this map’s result. [Official Bike Routes](https://data.cityofchicago.org/Transportation/Bike-Routes/hvv9-38ut), [CNT map](https://apps.cnt.org/bikechi/), [ChiWhoBike map](https://chiwho.bike/map/ward/35)

The street-centerline source cited by ChiWhoBike has older metadata and should not establish current turn restrictions on its own. [Street Center Lines](https://data.cityofchicago.org/Transportation/Street-Center-Lines/6imu-meau)

Import a Chicago-region network extending beyond the greenways. Follow relevant corridors to resolved endpoints where possible. If a run reaches the extract boundary, extend the extract during the offline build or retain an unresolved endpoint. A fixed buffer must never become an artificial forced turn, and the analysis must not stop tracing at the current slider maximum.

Each build records input URLs, retrieval dates, effective dates, checksums, licenses, override version, algorithm version, geometric defaults, and supported access profile. Display an “as of” date and retain required attribution. Data changes require a new immutable build.

## 5. Geometry preparation

Do this offline, before the distance solver:

1. Build actual at-grade street connectivity. Bridges and underpasses do not connect just because their lines cross. Preserve grade and layer information.
2. Split street edges at intersections, barriers, access changes, confirmed sharp turns, and greenway overlap boundaries. Preserve connector lengths when simplifying logical junctions.
3. Match greenway geometry to the street corridor using a spatial index, overlap, heading, and street identity. Do not use nearest-line snapping alone; parallel streets and frontage roads can be close together.
4. Store uncertain matches for review. They remain designated mileage in the denominator, shown as unknown.
5. Create one output segment for each unique designated physical centerline interval. Merge duplicate designation records. Do not count opposite bicycle travel directions twice.

The street geometry used to calculate driving distance and the greenway geometry used to report designated mileage may differ slightly. Store their lengths separately. Preserve enough matching metadata to explain differences.

Calculate lengths from unsimplified geometry using a documented geodesic method, then store integer millimetres. Display coarser units appropriate to map accuracy. Millimetres are a consistent internal representation, not a claim of survey precision. Simplify geometry only for map rendering, after scoring.

## 6. Offline distance algorithm

### 6.1 Representation

Represent each permitted traversal of a street edge as a directed state. A two-way street normally has two states; a one-way street has one. These are motor-vehicle states, independent of bicycle direction.

For each state `e`, record its length, underlying physical edge, and accepted straight successor `next[e]`. There is at most one accepted successor. There may be multiple predecessors at a resolved merge.

Ambiguous continuation choices are not guessed: leave the transition unresolved. Mark both the approach’s downstream side and every implicated candidate’s upstream side as open to an unresolved connection. This prevents an uncertain junction from creating falsely short, apparently exact runs on either side.

The v1 solver uses edge-local transitions. Restrictions involving a sequence of ways, conditional rules, and complicated junction movements must be resolved during normalization or flagged unresolved. Do not silently discard unsupported restriction relations. “No predecessor found” is a verified start only if topology and applicable restrictions at that endpoint have been resolved.

### 6.2 Linear-time calculation

For the acyclic portion of the accepted successor graph:

```text
length[e] = length of directed edge e
up[e]     = longest known straight path ending at e, including e
down[e]   = longest known straight path starting at e, including e

Initialize up[e] = length[e].
Build indegrees by scanning next[].
Run Kahn's topological traversal, storing its order.

For e in topological order:
    if next[e] exists:
        n = next[e]
        candidate = up[e] + length[n]
        if candidate > up[n]:
            up[n] = candidate
            longest_predecessor[n] = e
        up_open[n] |= up_open[e]

For e in reverse topological order:
    if next[e] exists:
        down[e] = length[e] + down[next[e]]
        down_open[e] |= down_open[next[e]]
    else:
        down[e] = length[e]

For e:
    known_run[e] = up[e] + down[e] - length[e]
    exact[e] = not (up_open[e] or down_open[e])
```

Initialize the open flags from unresolved endpoints and any unresolved direction/access information affecting the state. Upstream uncertainty propagates from **all** predecessors, including one that does not currently provide the longest known path. Resolve ties in witness selection deterministically by state ID.

The subtraction prevents double-counting the selected edge. On an ordinary uninterrupted chain, every edge receives the same full-chain distance. At a resolved merge, the shared downstream portion receives the longer permitted incoming run; shorter incoming branches keep their own appropriate scores.

This calculation is `O(E + T)` time and `O(E)` working memory, where `E` is directed states and `T <= E` is accepted transitions. Spatial matching, parsing, sorting, and tile generation have separate costs. There is no all-pairs search or enumeration of complete paths.

### 6.3 Cycles

After Kahn's traversal, unprocessed states identify cycles in this graph with at most one successor per state. Flag those states, then scan the processed order backward to flag all states whose successors lead to a cycle.

Quarantine these components before computing upstream/suffix scores: export an unresolved score with lower bound zero until their geometry is reviewed. Do not accumulate repeated laps, return infinity as a meaningful distance, recurse indefinitely, or declare the cycle endpoint a forced turn. Cycle detection is a data-quality safeguard for a straight-through model.

### 6.4 Combine directions and handle uncertainty

For each physical greenway segment:

```text
lower_bound_mm = maximum known_run across permitted motor directions
exact = every potentially relevant motor direction has been resolved exactly
```

A direction proven legally prohibited does not introduce uncertainty. A direction whose legality is unknown does. A confirmed segment inaccessible to ordinary motor vehicles has an exact score of zero. Unmatched segments have lower bound zero and `exact = false`.

For any positive X:

```text
if lower_bound_mm >= X_mm:       FAIL
else if exact:                  PASS
else:                           UNKNOWN
```

This means an incomplete run already known to extend 2 miles can fail a 1-mile test. It cannot pass a 3-mile test until its remaining extent is resolved. A segment with one resolved short direction and one unresolved direction is unknown, unless the known direction alone proves failure.

Retain witness pointers and endpoint reasons offline. On selection, a detail record should explain the controlling direction, endpoints, and evidence. Store witness paths once in optional detail assets rather than copying every full run into every map feature.

## 7. Memory design

Use separate indexed Rust arrays rather than a heap-allocated object with vectors and strings for every road edge. Rust's `Vec` provides contiguous element storage; use it for numeric columns with capacity planned from the input. [Rust Vec documentation](https://doc.rust-lang.org/std/vec/struct.Vec.html)

An illustrative distance-solver layout is:

| Array | Bytes per directed state |
| --- | ---: |
| Length: `u64` | 8 |
| Successor index: `u32` | 4 |
| Indegree: `u32` | 4 |
| Longest upstream distance: `u64` | 8 |
| Longest downstream distance: `u64` | 8 |
| Witness predecessor: `u32` | 4 |
| Physical-edge index: `u32` | 4 |
| Flags: `u32` | 4 |
| Topological order / queue: `u32` | 4 |
| **Core arrays** | **48** |

The queue can be the same vector as the stored order, with a moving read index. Reserve a `u32` sentinel for “none” and validate index capacity. Use checked `u64` distance arithmetic.

For illustration, one million directed states require about **48 MB of raw core arrays**. This is arithmetic, not a measured Chicago benchmark, and excludes geometry, source-ID maps, parser buffers, allocator capacity, spatial indexes, and tile generation.

Additional requirements:

- Stage large imports on disk. Use streaming or multipass extraction so all regional nodes and relations need not become language-level objects simultaneously.
- Keep geometry and strings outside the distance arrays; use pooled IDs and disk-backed records.
- Do not retain both parsed GeoJSON objects and duplicate graph geometry throughout the build.
- Restrict normalization and scoring to corridors relevant to greenways, while preserving surrounding junction approaches and all potentially relevant incoming continuations. Pruning must not create false endpoints.
- Begin with one preprocessing worker. Add parallelism only after measuring peak memory; multiple parsers or geometry copies can erase Rust's savings.
- Free matching indexes before scoring or tiling when they are no longer needed. Full rebuilds are acceptable for this city-scale, infrequently updated product.

## 8. Published data contract

Publish one immutable directory per build:

| Asset | Contents |
| --- | --- |
| `manifest.json` | Build ID, dates, schema, algorithms, sources, totals, checksums, attribution |
| `greenways.pmtiles` | Scored greenway geometry and minimal attributes |
| `summary.bin` | Sorted threshold distributions and cumulative designated lengths |
| `details/<shard>.json` | On-demand segment names, direction scores, endpoint reasons, evidence links |
| Optional `runs/<shard>.json` | Deduplicated witness geometry for a selected run |

Required feature properties:

| Field | Meaning |
| --- | --- |
| `sid` | Stable ID within this build; repeated consistently across tile fragments |
| `lb_mm` | Lower bound on longest driving run, or exact distance when `exact = 1` |
| `exact` | Integer 0 or 1 |
| `gw_mm` | Unique designated segment length for audit, not tile-based aggregation |
| `detail_id` | Reference to the small detail record |

Use checked `u32` export for individual run distances and IDs when they fit; fail the build or widen the schema rather than wrapping or silently clamping. Use `u64` for offline totals. JavaScript summary totals may use Float64 only after asserting all integer values remain within its exact-integer range.

Tile clipping can duplicate a feature into multiple tiles and zoom levels. Preserve its ID and score on every fragment. **Never calculate citywide mileage by summing rendered features.** All summary numbers come from the deduplicated offline table.

Features with different scores must not be merged during low-zoom generalization. Suppress visually tiny geometry if needed, but do not let that alter totals or the underlying designation inventory.

## 9. Dynamic X and summary algorithm

### 9.1 Map update

Convert miles to integer millimetres once per input change:

```text
X_mm = round(X_miles * 1_609_344)
```

Validate finite positive input. Apply the classifier from section 6.4 using a MapLibre paint expression. Example:

```typescript
map.setPaintProperty('greenways', 'line-color', [
  'case',
  ['>=', ['get', 'lb_mm'], xMm], '#C43D3D',
  ['==', ['get', 'exact'], 1],   '#187B55',
                                 '#7B8490'
]);
```

MapLibre supports feature-property comparisons and conditional expressions in paint properties. Validate the chosen expression against the pinned version during implementation. [MapLibre expressions](https://maplibre.org/maplibre-style-spec/expressions/), [map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)

Throttle updates to at most one per animation frame and keep the latest pending X. Avoid replacing GeoJSON, sending one feature-state update per segment, or allocating a new full feature collection on each event. Disable color transition animation during dragging so the displayed class tracks the selected threshold.

The renderer still does work on loaded geometry; this is not a claim that drawing is constant time. The expensive street-network calculation has been eliminated from interaction.

### 9.2 Totals

Build two distributions from the unique designated segment table:

1. **Exact:** exact scores, sorted ascending, with cumulative designated length.
2. **All:** lower-bound scores for all segments, sorted ascending, with cumulative designated length.

Aggregate equal scores to reduce size. At each X, use lower-bound binary search to find the first score `>= X`:

```text
passing_mm = exact-distribution length with score < X
failing_mm = all-distribution length with score >= X
unknown_mm = total_designated_mm - passing_mm - failing_mm
passing_share = passing_mm / total_designated_mm
```

The numeric update costs `O(log G)` for `G` output segments. Two distributions using `u32` thresholds and Float64 cumulative lengths use at most about `24G` bytes before headers and compression, usually less after grouping. At 10,000 hypothetical segments, that is at most about 240 KB of raw numeric arrays, not a claim about the actual Chicago segment count.

Specify little-endian encoding, aligned sections, schema version, record counts, and checksum in the manifest. Interpret the arrays without creating one JavaScript object per entry. A small JSON distribution is acceptable during development, but keep the production binary contract for predictable memory.

## 10. User interface

The initial view needs only:

- The map, showing designated greenways.
- Label: **“Flag streets where a driver can continue straight for at least…”**
- Slider: proposed range 0.125–2 miles, in 0.125-mile steps; default 0.5 mile.
- Numeric entry: proposed range 0.01–20 miles, accepting values between slider steps. Typed values outside the slider range remain valid; adapt the slider range rather than silently clamping the value.
- Legend: red “At least X”; green “Less than X”; gray “Unverified.”
- Passing mileage and share, plus failing and unverified mileage.
- Toggle: “Show only passing segments.” Use opacity/visibility styling, preserving a faint designation baseline and correct selection behavior.
- On selection: street and cross streets, full driving-run distance or “at least,” controlling direction, endpoint reasons, source date, and evidence links.
- A shareable URL containing X and map position. Use one canonical threshold value for the URL, map, labels, and totals.

Do not rely on color alone. Use distinct line treatments where practical and textual status in the legend and popup. All controls must work with a keyboard. A mobile screen must retain the numeric control and summary without obscuring the map.

Detail assets load only on demand. Keep a small bounded cache and discard old detail geometry. Use one selected-feature overlay, not one DOM marker per street segment. Bound tile caches and worker counts using supported options in the pinned renderer version. Avoid imagery, 3D terrain, and unnecessary layers in this application.

## 11. Acceptance tests

### Algorithm and data correctness

| Fixture | Expected result |
| --- | --- |
| Two-mile uninterrupted chain, X = 0.5 mile | Every designated portion fails |
| Quarter-mile run, X = 0.5 mile | Every designated portion passes |
| Run exactly equal to X | Fails |
| Selected block near the end of a long run | Receives full run distance, not remaining distance |
| Same chain split into extra geometry edges | Same scores and classifications, within the documented integer length representation |
| Speed hump, signal, or stop sign inserted | Driving distance unchanged |
| Genuine forced turn inserted | Scores recomputed on the resulting runs |
| Greenway designation covers only part of a longer street | Driving score includes the unmarked continuation; mileage totals include only designated portions |
| One-way reversal or a direction-specific restriction | Each permitted direction evaluated correctly; no addition of opposing run lengths |
| Bicycle contraflow | No extra car direction created |
| Resolved merge with unequal incoming lengths | Shared downstream portion uses longest valid incoming path |
| Unknown upstream alternative shorter in the current extract | Exactness remains false because it might extend farther |
| Known two-mile run ending at an import boundary | Fails X = 1 mile; unknown at X = 3 miles |
| Ambiguous fork or missing restriction interpretation | No false passing classification on either side |
| Road-name change, overpass, and divided intersection | Name change does not break a run; overpass does not connect; intersection is normalized |
| Cycle or path entering a cycle | Unknown; terminates safely without repeated laps |
| Duplicate designation and vector-tile fragments | No duplicated mileage |
| Increasing X | Passing mileage never decreases |
| Small generated graphs | Optimized results equal an independent brute-force oracle |

Require `passing + failing + unknown = total designated length` at every tested threshold. Map features and summary calculations must agree at equality and just above/below every distinct score. Reloading and sharing a URL must preserve X exactly at the selected internal precision.

### Pilot validation

Start with Ward 35 plus all necessary street continuations beyond its borders. Manually verify every pilot endpoint that makes a segment pass and every unresolved matching or movement decision before presenting a complete pilot. Review representative long runs in both directions. A pilot with remaining gaps may ship only with those gaps explicitly gray and the unresolved mileage visible.

### Performance targets to measure

These are initial acceptance targets, not benchmark results:

- Summary-index decoded size under 1 MB for the initial citywide product; investigate unexpected growth.
- Summary update under 10 ms and visible threshold response under 100 ms at the 95th percentile on the recorded test device.
- No threshold-specific network request and no routing computation during slider interaction.
- After warmup, repeated slider sweeps show a bounded memory plateau rather than retained growth.
- Offline peak process memory target under 512 MB for the agreed regional build; report stage-by-stage peaks and change the pipeline if parsing or tiling exceeds the budget.

Record dataset size, browser/version, device, viewport/zoom, worker/cache settings, total page memory where measurable, and peak preprocessing RSS. Do not report JavaScript heap alone as total browser memory: workers and graphics allocations also matter. Compare Rust arrays against an equivalent compact representation if evaluating languages; object-heavy implementations are not a fair language comparison.

## 12. Build sequence and completion criteria

1. **Lock definitions and fixtures.** Implement the distance and uncertainty classifier against synthetic chains, merges, one-way changes, and equality cases. Freeze the movement policy for the pilot.
2. **Prepare the pilot inventory.** Snapshot source data, match greenways, normalize junctions, and review overrides. Produce an audit table with endpoint reasons.
3. **Build the Rust preprocessor.** Emit scored segments, witnesses, and summary distributions. Validate against the independent oracle and record memory usage.
4. **Build the static map.** Wire X to paint expressions and binary-search summaries. Verify that changing X makes no calculation API calls.
5. **Review and expand.** Correct pilot errors, then process citywide data with the same rules. Keep unresolved records visible instead of inventing short runs.

An implementation is complete when a reviewer can select a greenway segment, see the run and endpoints that determine its score, reproduce its classification at any supported X, and reconcile the displayed totals to the unique designated inventory. The development handoff should include source snapshots, overrides, the versioned manifest, the Rust CLI, frontend source, test fixtures, and build instructions.

The core implementation decision is fixed: **one offline distance calculation per data version; lightweight comparison and rendering for every user-selected X.**

## 13. Specification verification performed

A small Python reference implementation of the proposed graph calculation was checked while preparing this document:

- 1,000 generated acyclic successor graphs matched an independent brute-force enumeration for both distances and uncertainty propagation.
- Explicit fixtures passed for a chain, unequal-length merge, cycle, path entering a cycle, unrelated resolved component, and incomplete extract boundary.
- 1,000 generated segment datasets passed checks for classification partitioning and threshold monotonicity; equality and unresolved-bound behavior were also checked.

These checks validate the proposed numerical logic. They do not validate Chicago street data, geometric matching, a production Rust implementation, browser performance, or the provisional memory budgets. Those remain implementation acceptance work.
