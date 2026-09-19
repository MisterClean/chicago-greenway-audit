# Implementation status

This is an operational inventory/review pilot plus a tested scoring and publication system. It is not a completed Ward 35 driving audit and must not be represented as one.

| Spec workstream | Status |
| --- | --- |
| Product definitions / equality / uncertainty | Implemented |
| Rust distance solver / cycle quarantine / witnesses | Implemented and oracle-tested |
| Angular decision policy | Implemented and tested; approach headings/connector normalization not implemented |
| Official inventory snapshot, clipped unique mileage | Implemented for Ward 35 |
| Full OSM snapshot and disk staging / spatial index | Implemented |
| Source match candidates | 40/40 intervals have candidates; zero approved matches |
| At-grade splitting, motor access, relations, bends, logical junctions | Not implemented; raw information retained for the normalization stage |
| Manual endpoint and movement review | Pending; zero approved endpoints |
| Immutable PMTiles, summary, detail and run publication | Implemented, including reviewed normalized bundle input |
| Static map and keyboard/mobile controls | Implemented |
| Citywide extension / newer project reconciliation | Pending pilot review |
| Browser memory plateau / representative physical-device latency | Not established |

## Next engineering stage

1. Build a normalized topology from the staged OSM database, using node IDs and grade/layer information; never connect geometric overpasses.
2. Split at barriers, access/direction changes, junctions, confirmed bends, and designation overlaps. Infer no reverse car state from bicycle contraflow. Unsupported conditional and via-way restrictions must taint all implicated transitions.
3. Match full designated intervals using heading and overlap, with street identity as supporting evidence. The current report identifies candidates only and cannot establish a match.
4. Compute 20 m projected headings and feed the frozen 30°/60° policy. Apply movement legality only after selecting the geometric straight candidate. Preserve connector distance; uncertain forks, circles and offsets stay open on both sides.
5. Trace all relevant upstream branches and downstream continuations outside Ward 35, extending the source extract if necessary. Export dense state IDs and reviewed segment associations.
6. Record reviewer, dated evidence, legal profile and endpoint reasons. Validate every endpoint that creates a passing segment. Reconcile newer projects before calling the inventory current.
7. Publish a new immutable reviewed bundle; preserve remaining gaps as gray. Validate full-run geometry against the source, then expand citywide.

The current pilot contains no resolved motor states. Every displayed lower bound is zero and every segment is unverified. This is an explicit review gap, not a finding that all streets pass or fail.
