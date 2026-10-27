# Directional vehicle continuity: pilot validation

The expanded 16-section candidate and its current source checks are documented in [route-expansion-validation.md](route-expansion-validation.md). The pilot findings below describe the earlier four-street review.

This pilot maps source-inferred passenger-car continuity on selected Wood, Berteau, Leland and Dickens greenway sections. It is a review aid, not a completed driving or cycling-stress audit. **Zero movements have been field reviewed.** An allowed source decision means the stored inputs support a provisional inference; it does not establish current signage, actual traffic volume, speed, cycling comfort or safety.

## Inputs and output

- Chicago's bike-route designation snapshot is labeled December 2025. Its geometry and source IDs describe the mapped greenway, not necessarily the legal motor route.
- The BBBike Chicago OSM extract was effective September 11, 2026; its recorded SHA-256 and provenance are in `data/sources/osm-source.json`. OSM object links are live and may change after the snapshot. The local SQLite stage preserves the data used for this build.
- `data/routes/pilots.json` selects the four streets. `public/routes/pilot.json` contains designated geometry, matched road/path edges, directional decisions, movements, events, runs and coverage. The selected output has eight route sections, not eight independently field-verified routes. A connector between separated designation records is a review question, not proof that the city designated the intervening segment.
- `data/routes/review-evidence.json` records selected project sources, dates, scope, confidence and unresolved field questions. It is an evidence queue, not a set of movement approvals. `data/routes/pilot-validation.json` records a bounded source-consistency sample and the SHA-256 of the output examined. Compare that hash with the current file before relying on the sample; rebuilds can change identifiers and invalidate it.

The default profile is an ordinary passenger car making a through trip. Bike exceptions, destination-only access and roadway geometry must not be treated as general through-car permission. A stop or ordinary traffic-calming device is not automatically a barrier. Unknown means the available evidence cannot resolve a decision; it is neither an allowed movement nor a confirmed obstruction. An end of mapped scope is not evidence that a car must exit the street.

## Pilot findings and review priorities

| Location | Source evidence and limit | Next review |
| --- | --- | --- |
| Wood, Augusta–Cortez and Division–Crystal | OSM and the [1st Ward project](https://www.the1stward.com/woodst) describe southbound motor travel and two-way bicycle access on these blocks; the ward construction text is a plan, not a specific completion notice. The exact northbound restriction events link to the ward/CDOT project and the corresponding OSM ways; the contraflow exception is for bicycles. | Check both ends, current one-way signs and approach movements. Do not extend either block's restriction to all of Wood. |
| Berteau / Greenview | OSM includes an unnamed traffic circle, `junction=circular`, without an explicit one-way direction. The local source supports geometry but does not settle the permitted arcs. | Record current approach signs and markings, circulation and departure for each direction. A manually opened panorama did not yield a legible capture date or directional signs. |
| Leland / Western | OSM [relation 20163015](https://www.openstreetmap.org/relation/20163015) prohibits the specific eastbound straight movement. The [40th Ward project page](https://40thward.org/project/leland-greenway-2/) labels the broad project completed but its September 2025 update describes the diverter in future tense. Separated city designation sections do not, by themselves, establish the intervening route. | Verify the exact eastbound and westbound approaches, current signs, physical layout and route correspondence. Distinguish a legal rule from a physical barrier. |
| Dickens / Burling and Oz Park | The snapshot contains destination-only motor access and bicycle paths. Those paths do not prove a corresponding through-car connection. City and OSM direction attributes also disagree on parts of Dickens. | Resolve the route through the park and the conflicting direction using current official records and dated observations; check both directions. |
| Dickens / Lincoln Park West and Stockton | A [contemporaneous firsthand report](https://chi.streetsblog.org/2024/10/07/nimbys-win-ald-knudsen-are-letting-motorheads-have-their-way-by-giving-dickens-bike-ped-plaza-back-to-dangerous-cut-through-traffic) reports that the plaza was dismantled and westbound travel resumed on October 11, 2024. It does not establish the present state or the reverse movement. | Obtain current, dated evidence for each approach. Do not use the earlier plaza plan as a current closure. |

An ordinary manual Street View viewer was used to investigate available viewpoints; no Google imagery was copied into the repository or converted into accepted route data. Capture dates matter: an older image cannot confirm a later construction change, and a visible opening alone does not establish legal access. Use official records and owned or appropriately licensed field observations for durable assertions. Document the source, effective or capture date, observation date, exact movement, method, reviewer, exceptions and conflicts.

## Reproduce and inspect

From the repository root, with the recorded source snapshots and staged `data/staging/network.sqlite` available:

```sh
node scripts/build-route-data.mjs
node scripts/verify-route-data.mjs
npm test
shasum -a 256 public/routes/pilot.json
```

The first command rebuilds the pilot output and ordinarily changes its generation timestamp. `SOURCE_DATE_EPOCH` may be set to a fixed Unix timestamp for reproducible output when all inputs and code are unchanged. The verifier checks output structure, movement/edge adjacency, run geometry and lengths, evidence labels, coverage arithmetic and selected cases. Unit tests exercise the movement rules and tracing. These checks do not verify the real-world truth of OSM tags, the route assembly, or current ground conditions.

On October 27, 2026, the verifier passed for 8 route sections, 482 movements and 22 runs; `npm test` passed 43 tests. The independently sampled output has SHA-256 `1316c45fd6236587166c7f7c4c2655e11550c94f508d69ba63a8635183faf235`. These numbers describe that build only.

The production build also passed TypeScript and Vite compilation. Browser checks covered desktop and phone layouts, both directional traces and arrows, clicked remaining distance, keyboard slider adjustment without lost focus, Leland's specific restriction and source links, and restoration of shared interruption and measurement URLs. The phone legend is outside the map canvas so it does not cover route endpoints. Vite reports the existing large MapLibre bundle warning; it does not prevent the static build. No Rust source was changed.

The separate validation file contains 32 directional movement samples: two same-way junctions per route section, each checked in both directions against the staged OSM node and relation data. It also records 12 targeted checks for Wood, the Berteau circle, Leland, Dickens, reverse-event coordinates and unreviewed joins; all passed on that build. A sample checks a narrow junction decision, not permission to traverse its adjacent edges. Sampling does not cover every junction and must not be reported as 32 field approvals. Its `input_sha256` identifies the exact output reviewed; regenerate or explicitly mark the record stale after any output change.

## Before broader or field-verified claims

1. Resolve route assembly and account for every designation gap, alternative, road/path correspondence and connector in both directions. Keep unresolved joins and conflicts visible; distinguish them from mapped scope ends.
2. Review a representative set of directional approaches and departures, then every remaining pilot movement and interruption, including unrestricted-looking interiors. Obtain current signs, applicable exceptions, physical openings and dated source evidence. Reconcile disagreement instead of silently choosing a source.
3. Compare each displayed run and boundary with an independent manual trace and check distance, direction, connector inclusion and evidence scope. Reserve holdout cases and document false-open, false-closed and unresolved decisions.
4. Expand beyond the pilot only after those checks pass with no silent unmatched intervals and no unexplained errors on reviewed cases. Report the coverage and remaining uncertainty rather than extrapolating pilot performance to the city.
5. A cycling-stress assessment requires separate evidence about traffic volume, speeds, crossings and rider conditions. Vehicle continuity alone measures potential through access; it does not establish traffic levels or stress.
