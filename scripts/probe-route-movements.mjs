// Bounded experiments on real source geometry, not reviewed legal route results.
// Run scripts/probe-greenway-data.mjs first, then this script.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import geodesic from 'geographiclib-geodesic';
import { traceRoute } from './route-continuity.mjs';

const evidence = JSON.parse(await readFile('data/experiments/data-probe.json', 'utf8'));
const decision = (status, reason) => ({ status, reason });
const allowed = (reason) => decision('allowed', reason);
const blocked = (reason) => decision('blocked', reason);
const unknown = (reason) => decision('unknown', reason);
const endpoints = {
  start: { kind: 'unknown', reason: 'Bounded experiment begins here; upstream route continuation was not assessed.' },
  end: { kind: 'unknown', reason: 'Bounded experiment ends here; downstream route continuation was not assessed.' },
};
const length = (a, b) => geodesic.Geodesic.WGS84.Inverse(a[1], a[0], b[1], b[0]).s12;
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} differs from ${b}`);

const lelandEvidence = evidence.cases.find((c) => c.id === 'leland-western-no-straight');
const [west, east] = lelandEvidence.ways;
assert.equal(west.node_ids.at(-1), east.node_ids.at(-1));
assert.equal(west.tags.oneway, 'yes');
assert.equal(west.tags['oneway:bicycle'], 'no');
const junction = west.node_ids.at(-1);
const relation = lelandEvidence.relations[0];
assert.equal(relation.tags.restriction, 'no_straight_on');
assert.ok(relation.members.some((m) => m.role === 'from' && m.ref === west.id));
assert.ok(relation.members.some((m) => m.role === 'to' && m.ref === east.id));
assert.ok(relation.members.some((m) => m.role === 'via' && m.ref === junction));
const lelandRoute = {
  id: 'leland-western-topology-only-counterfactual',
  profile: 'through_car',
  edges: [
    { id: String(west.id), length_m: west.length_m, access: {
      forward: allowed('OSM scenario: motor oneway=yes follows node order eastward.'),
      reverse: blocked('Motor oneway=yes prohibits reverse travel; oneway:bicycle=no does not apply to cars.'),
    } },
    { id: String(east.id), length_m: east.length_m, access: {
      forward: allowed('OSM scenario: ordinary residential/secondary motor road without a one-way restriction; route reverses source node order.'),
      reverse: allowed('OSM scenario: road has no one-way restriction; route reverse follows source node order.'),
    } },
  ],
  movements: [{ id: `node:${junction}`, forward: allowed('Deliberately omit the turn restriction for this topology-only comparison.'), reverse: blocked('The departing west-side road is one-way against this movement.') }],
  endpoints,
};
const lelandTopology = traceRoute(lelandRoute);
const lelandRestrictedRoute = structuredClone(lelandRoute);
lelandRestrictedRoute.id = 'leland-western-osm-restriction-applied';
lelandRestrictedRoute.movements[0].forward = blocked(`OSM relation ${relation.id}: no_straight_on for this from/via/to movement (implicit=yes; unverified).`);
const lelandRestricted = traceRoute(lelandRestrictedRoute);
const forwardTopology = lelandTopology.runs.filter((r) => r.direction === 'forward');
const forwardRestricted = lelandRestricted.runs.filter((r) => r.direction === 'forward');
assert.equal(forwardTopology.length, 1);
close(forwardTopology[0].length_m, west.length_m + east.length_m);
assert.equal(forwardRestricted.length, 2);
close(forwardRestricted[0].length_m, west.length_m);
close(forwardRestricted[1].length_m, east.length_m);
assert.ok(lelandRestricted.excluded.some((e) => e.edge_id === String(west.id) && e.direction === 'reverse' && e.status === 'blocked'));
assert.ok(lelandRestricted.runs.every((r) => !r.complete_within_route));

const berteauEvidence = evidence.cases.find((c) => c.id === 'berteau-greenview-circle');
const [approach, circle, departure] = berteauEvidence.ways;
assert.equal(circle.tags.name, undefined);
assert.equal(circle.tags.junction, 'circular');
assert.equal(circle.tags.oneway, undefined);
const circleNodes = circle.node_ids.slice(0, -1);
const entryIndex = circleNodes.indexOf(approach.node_ids.at(-1));
const exitIndex = circleNodes.indexOf(departure.node_ids[0]);
assert.ok(entryIndex >= 0 && exitIndex >= 0);
const arc = (step) => {
  let index = entryIndex, meters = 0;
  const ids = [circleNodes[index]], geometry = [circle.geometry[index]];
  while (index !== exitIndex) {
    const next = (index + step + circleNodes.length) % circleNodes.length;
    meters += length(circle.geometry[index], circle.geometry[next]);
    index = next;
    ids.push(circleNodes[index]);
    geometry.push(circle.geometry[index]);
    assert.ok(ids.length <= circleNodes.length, 'No repeated laps are permitted.');
  }
  return { direction_relative_to_source: step === 1 ? 'forward' : 'reverse', length_m: meters, node_ids: ids, geometry };
};
const arcs = [arc(1), arc(-1)];
const shortestArc = arcs.reduce((a, b) => a.length_m < b.length_m ? a : b);
const namedOnlyNodes = new Set(approach.node_ids);
const namedOnlyConnected = departure.node_ids.some((id) => namedOnlyNodes.has(id));
assert.equal(namedOnlyConnected, false);
const approachEdge = { id: String(approach.id), length_m: approach.length_m, access: {
  forward: allowed('OSM westbound motor oneway=yes follows source node order.'),
  reverse: blocked('Bicycle contraflow does not grant reverse motor access.'),
} };
const departureEdge = { id: String(departure.id), length_m: departure.length_m, access: {
  forward: allowed('OSM westbound motor oneway=yes follows source node order.'),
  reverse: blocked('Bicycle contraflow does not grant reverse motor access.'),
} };
const berteauNamedOnly = traceRoute({
  id: 'berteau-name-only-missing-connector', profile: 'through_car', edges: [approachEdge, departureEdge],
  movements: [{ id: 'omitted-circle', forward: unknown('Name-filtered source omitted the unnamed circle; this gap is not a confirmed blockage.'), reverse: blocked('Motor one-way approaches prevent reverse travel.') }], endpoints,
});
const berteauUnresolvedInput = {
  id: 'berteau-circle-included-direction-unresolved', profile: 'through_car',
  edges: [approachEdge, { id: `${circle.id}:node-order-arc`, length_m: arcs[0].length_m, access: {
    forward: unknown('junction=circular has no oneway tag; do not adjudicate the legal circulation direction from this source.'),
    reverse: unknown('Circle direction has not been reviewed.'),
  } }, departureEdge],
  movements: [
    { id: `entry:${approach.node_ids.at(-1)}`, forward: allowed('Scenario: connected entry node; local movement still needs review.'), reverse: blocked('Reverse approach is motor one-way.') },
    { id: `exit:${departure.node_ids[0]}`, forward: allowed('Scenario: connected exit node; local movement still needs review.'), reverse: blocked('Reverse departure is motor one-way.') },
  ], endpoints,
};
const berteauUnresolved = traceRoute(berteauUnresolvedInput);
const berteauScenarioInput = structuredClone(berteauUnresolvedInput);
berteauScenarioInput.id = 'berteau-node-order-circle-scenario-not-verified';
berteauScenarioInput.edges[1].access.forward = allowed('Counterfactual/scenario assumption only: circle permits traffic in its source node order.');
const berteauScenario = traceRoute(berteauScenarioInput);
assert.equal(berteauNamedOnly.runs.filter((r) => r.direction === 'forward').length, 2);
assert.equal(berteauUnresolved.runs.filter((r) => r.direction === 'forward').length, 2);
assert.equal(berteauScenario.runs.filter((r) => r.direction === 'forward').length, 1);
close(berteauScenario.runs.find((r) => r.direction === 'forward').length_m, approach.length_m + arcs[0].length_m + departure.length_m);
assert.ok(berteauScenario.runs.every((r) => !r.complete_within_route));

const output = {
  schema: 'greenway-real-movement-experiment-v1',
  status: 'Experiments on saved OSM evidence. No field-verified movement, maximal greenway driving run, or safety finding is asserted.',
  source_effective_date: evidence.source_effective_date,
  source_sha256: evidence.source_sha256,
  distance_method: 'GeographicLib WGS84 inverse distance summed along source polylines, meters.',
  endpoint_policy: 'All outer endpoints are unknown/truncated experiment boundaries, never physical motor blockers.',
  checks: 'Assertions passed: shared-node relation identity, directional orientation, split distances, bicycle exemption separation, missing connector, no repeated circle laps, and incomplete source boundaries.',
  leland: {
    evidence: lelandEvidence,
    route_forward: 'Eastbound: way 1464448283 in source order, then way 625511923 in reversed source order.',
    topology_only_input: lelandRoute,
    topology_only_result: lelandTopology,
    restriction_applied_input: lelandRestrictedRoute,
    restriction_applied_result: lelandRestricted,
    conclusion: 'Connected geometry alone produces 70.3924455m of eastbound candidate passage. The exact OSM no_straight_on movement splits it into 18.0967146m and 52.2957309m observed pieces. Reverse motor passage is independently blocked by one-way access. All pieces have truncated outer boundaries.',
  },
  berteau: {
    evidence: berteauEvidence,
    named_only_connected: namedOnlyConnected,
    circle_arcs: arcs,
    shortest_topological_arc: shortestArc,
    shortest_arc_is_legally_verified: false,
    direction_reference: 'https://wiki.openstreetmap.org/wiki/Tag:junction=circular',
    name_only_result: berteauNamedOnly,
    unresolved_input: berteauUnresolvedInput,
    unresolved_result: berteauUnresolved,
    node_order_scenario_input: berteauScenarioInput,
    node_order_scenario_result: berteauScenario,
    conclusion: 'Exact-name matching removes the connecting circle. Including its shared nodes restores topology, but missing circular-junction direction remains unknown. A stated node-order circulation scenario joins the approaches without calling the road turn an interruption. This is not an accepted legal run.',
  },
};
await writeFile('data/experiments/route-movement-probe.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({
  leland_topology_m: forwardTopology[0].length_m,
  leland_restricted_pieces_m: forwardRestricted.map((r) => r.length_m),
  berteau_named_only_connected: namedOnlyConnected,
  berteau_arc_lengths_m: arcs.map((a) => a.length_m),
  berteau_node_order_scenario_m: berteauScenario.runs.find((r) => r.direction === 'forward').length_m,
  legal_circle_direction: 'unknown',
  all_experiment_boundaries: 'unknown/truncated',
  output: 'data/experiments/route-movement-probe.json',
}, null, 2));
