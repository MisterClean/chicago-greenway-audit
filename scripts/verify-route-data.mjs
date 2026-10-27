// Independent checks of the published pilot; run with node scripts/verify-route-data.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import geodesic from 'geographiclib-geodesic';

const data = JSON.parse(await readFile(new URL('../public/routes/pilot.json', import.meta.url), 'utf8'));
const distance = (a, b) => geodesic.Geodesic.WGS84.Inverse(a[1], a[0], b[1], b[0]).s12;
const length = line => line.slice(1).reduce((sum, point, i) => sum + distance(line[i], point), 0);
const close = (a, b, label, tolerance = 0.01) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance, `${label}: ${a} versus ${b}`);
const samePoint = (a, b, label) => close(distance(a, b), 0, label);
const routeLines = geometry => geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
const sourceLabel = (decision, label) => assert.ok(['source-inferred', 'conflicting'].includes(decision.evidence_status), `${label}: unexpected evidence label ${decision.evidence_status}`);

assert.equal(data.summary.evidence_status, 'source-inferred');
assert.equal(data.summary.route_components, data.routes.length);
let movementCount = 0, runCount = 0;
for (const route of data.routes) {
  const { edges, movements, runs, coverage } = route;
  const byId = new Map(edges.map((edge, index) => [edge.id, { edge, index }]));
  assert.equal(byId.size, edges.length, `${route.id}: duplicate edge`);
  assert.equal(movements.length, edges.length - 1, `${route.id}: movement count`);
  assert.equal(coverage.total_movements, movements.length, `${route.id}: coverage movement count`);
  assert.equal(coverage.reviewed_movements, 0, `${route.id}: pilot is not field reviewed`);
  close(coverage.designated_m, routeLines(route.geometry).reduce((sum, line) => sum + length(line), 0), `${route.id}: designation length`);
  close(coverage.matched_m + coverage.unknown_m, coverage.designated_m, `${route.id}: coverage accounting`);
  assert.ok(coverage.matched_m >= 0 && coverage.unknown_m >= 0, `${route.id}: negative coverage`);
  if (route.geometry.type === 'LineString') {
    close(coverage.unknown_m, edges.filter(edge => edge.role === 'gap').reduce((sum, edge) => sum + length(edge.geometry.coordinates), 0), `${route.id}: unmatched designation length`);
  }
  for (const edge of edges) {
    assert.equal(edge.geometry.type, 'LineString');
    assert.ok(edge.geometry.coordinates.length >= 2, `${edge.id}: missing geometry`);
    close(edge.length_m, length(edge.geometry.coordinates), `${edge.id}: edge length`);
    for (const direction of ['forward', 'reverse']) sourceLabel(edge.access[direction], `${edge.id} ${direction}`);
  }
  for (let i = 0; i < movements.length; i++) {
    const m = movements[i];
    assert.equal(m.from_edge, edges[i].id, `${m.id}: incoming edge`);
    assert.equal(m.to_edge, edges[i + 1].id, `${m.id}: outgoing edge`);
    samePoint(m.coordinate, edges[i].geometry.coordinates.at(-1), `${m.id}: coordinate`);
    for (const direction of ['forward', 'reverse']) sourceLabel(m[direction], `${m.id} ${direction}`);
  }
  for (const run of runs) {
    runCount++;
    assert.equal(run.evidence_status, 'source-inferred', `${run.id}: evidence`);
    assert.ok(['forward', 'reverse'].includes(run.direction));
    assert.equal(run.geometry.type, 'MultiLineString');
    assert.equal(run.edge_ids.length, run.geometry.coordinates.length, `${run.id}: geometry parts`);
    assert.ok(run.edge_ids.length > 0, `${run.id}: empty run`);
    let sum = 0, previous;
    for (let i = 0; i < run.edge_ids.length; i++) {
      const record = byId.get(run.edge_ids[i]);
      assert.ok(record, `${run.id}: unknown edge ${run.edge_ids[i]}`);
      const { edge, index } = record;
      assert.equal(edge.access[run.direction].status, 'allowed', `${run.id}: non-allowed edge ${edge.id}`);
      const expected = run.direction === 'forward' ? edge.geometry.coordinates : [...edge.geometry.coordinates].reverse();
      const actual = run.geometry.coordinates[i];
      assert.equal(actual.length, expected.length, `${run.id}: edge geometry shape`);
      for (let j = 0; j < expected.length; j++) samePoint(actual[j], expected[j], `${run.id}: oriented geometry`);
      sum += length(actual);
      if (previous) {
        const step = run.direction === 'forward' ? 1 : -1;
        assert.equal(index, previous.index + step, `${run.id}: non-adjacent route edges`);
        samePoint(previous.line.at(-1), actual[0], `${run.id}: disconnected geometry`);
        const movement = movements[Math.min(index, previous.index)];
        assert.equal(movement[run.direction].status, 'allowed', `${run.id}: non-allowed movement ${movement.id}`);
      }
      previous = { index, line: actual };
    }
    close(run.length_m, sum, `${run.id}: run length`);
    samePoint(run.start.coordinate, run.geometry.coordinates[0][0], `${run.id}: start boundary`);
    samePoint(run.end.coordinate, run.geometry.coordinates.at(-1).at(-1), `${run.id}: end boundary`);
    for (const [side, edgeId] of [['start', run.edge_ids[0]], ['end', run.edge_ids.at(-1)]]) {
      const index = byId.get(edgeId).index;
      const step = run.direction === 'forward' ? 1 : -1;
      const neighborIndex = index + (side === 'start' ? -step : step);
      const boundary = run[side];
      if (neighborIndex < 0 || neighborIndex >= edges.length) {
        assert.ok(['scope_end', 'unknown'].includes(boundary.kind), `${run.id}: invalid outer ${side}`);
      } else {
        const movement = movements[Math.min(index, neighborIndex)];
        const decisions = [edges[neighborIndex].access[run.direction], movement[run.direction]];
        const expected = decisions.some(d => d.status === 'blocked') ? 'blocked' : 'unknown';
        assert.ok(decisions.some(d => d.status !== 'allowed'), `${run.id}: unnecessary ${side} boundary`);
        assert.equal(boundary.kind, expected, `${run.id}: ${side} boundary kind`);
        assert.ok(boundary.sources?.length, `${run.id}: missing ${side} evidence references`);
        for (const source of boundary.sources) {
          assert.ok([`edge:${edges[neighborIndex].id}`, `movement:${movement.id}`].includes(source), `${run.id}: invalid boundary source ${source}`);
        }
      }
    }
    assert.equal(run.complete_within_route, run.start.kind !== 'unknown' && run.end.kind !== 'unknown', `${run.id}: completeness`);
    assert.equal(run.scope_limited, run.start.kind === 'scope_end' || run.end.kind === 'scope_end', `${run.id}: scope`);
  }
  for (const event of route.events) sourceLabel(event, `${event.id}: event`);
  movementCount += movements.length;
}
assert.equal(data.summary.total_movements, movementCount);
assert.equal(data.summary.reviewed_movements, 0);
const wood = data.routes.filter(route => route.name === 'Wood').flatMap(route => route.edges);
for (const way of [1444797397, 1444797396]) {
  const matches = wood.filter(edge => edge.way_id === way);
  assert.ok(matches.length, `Wood way ${way} is missing`);
  for (const edge of matches) {
    assert.equal(edge.access.forward.status, 'blocked', `${edge.id}: northbound`);
    assert.equal(edge.access.reverse.status, 'allowed', `${edge.id}: southbound`);
  }
}
const leland = data.routes.find(route => route.name === 'Leland');
assert.ok(leland, 'Leland route missing');
assert.ok(leland.movements.some(m => m.forward.status === 'blocked' && m.evidence_urls.includes('https://www.openstreetmap.org/relation/20163015')), 'Leland eastbound Western restriction missing');
for (const name of ['Leland', 'Dickens']) {
  const route = data.routes.find(candidate => candidate.name === name);
  assert.ok(route, `${name} route missing`);
  const connectors = route.edges.filter(edge => edge.role === 'connector');
  assert.ok(connectors.length, `${name}: expected unresolved connectors`);
  for (const edge of connectors) {
    for (const direction of ['forward', 'reverse']) {
      assert.notEqual(edge.access[direction].status, 'allowed', `${edge.id}: unreviewed connector is allowed`);
    }
  }
}
console.log(`Validated ${data.routes.length} routes, ${movementCount} movements and ${runCount} runs; all evidence is source-inferred or conflicting.`);
