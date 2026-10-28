import test from 'node:test';
import assert from 'node:assert/strict';
import { traceRoute } from './route-continuity.mjs';

const decision = (status = 'allowed', reason = 'Reviewed through-car passage') => ({ status, reason });
const pair = () => ({ forward: decision(), reverse: decision() });
const route = (lengths = [100, 200, 300]) => ({
  id: 'fixture', profile: 'through_car',
  edges: lengths.map((length_m, i) => ({ id: `e${i}`, length_m, access: pair() })),
  movements: lengths.slice(1).map((_, i) => ({ id: `j${i}`, ...pair() })),
  endpoints: {
    start: { kind: 'scope_end', reason: 'Start of designated greenway' },
    end: { kind: 'scope_end', reason: 'End of designated greenway' },
  },
});
const runs = (result, direction = 'forward') => result.runs.filter(run => run.direction === direction);

test('follows an allowed right turn on the designated route; signals and stops do not break it', () => {
  const input = route();
  input.movements[0].turn_degrees = 90;
  input.movements[0].forward.reason = 'Designated route turns right at signal; permitted';
  input.movements[1].forward.reason = 'Stop sign; continuing is permitted';
  const result = traceRoute(input);
  assert.deepEqual(runs(result).map(run => run.length_m), [600]);
  assert.deepEqual(runs(result, 'reverse')[0].edge_ids, ['e2', 'e1', 'e0']);
  assert.equal(runs(result)[0].start.kind, 'scope_end');
  assert.equal(runs(result)[0].end.kind, 'scope_end');
  assert.equal(runs(result)[0].scope_limited, true);
  assert.equal(runs(result)[0].complete_within_route, true);
});

test('opposing one-way edges never concatenate and each direction remains independent', () => {
  const input = route([100, 200]);
  input.edges[0].access.reverse = decision('blocked', 'One-way forward');
  input.edges[1].access.forward = decision('blocked', 'One-way reverse');
  const result = traceRoute(input);
  assert.deepEqual(runs(result).map(run => run.length_m), [100]);
  assert.deepEqual(runs(result, 'reverse').map(run => run.length_m), [200]);
  assert.equal(runs(result)[0].end.kind, 'blocked');
  assert.equal(runs(result, 'reverse')[0].end.reason, 'One-way forward');
});

test('a no-straight restriction cuts only the affected route movement and direction', () => {
  const input = route([100, 200]);
  input.movements[0].forward = decision('blocked', 'No straight: this route continues straight');
  const result = traceRoute(input);
  assert.deepEqual(runs(result).map(run => run.length_m), [100, 200]);
  assert.deepEqual(runs(result, 'reverse').map(run => run.length_m), [300]);
  assert.equal(runs(result)[0].end.reason, input.movements[0].forward.reason);
  assert.equal(runs(result)[1].start.kind, 'blocked');
});

test('unknown movement separates confirmed chains without proving a short maximum', () => {
  const input = route([100, 200]);
  input.movements[0].forward = decision('unknown', 'Median opening needs review');
  const result = traceRoute(input);
  assert.deepEqual(runs(result).map(run => [run.length_m, run.complete_within_route]), [[100, false], [200, false]]);
  assert.equal(runs(result)[0].end.kind, 'unknown');
  assert.equal(runs(result)[1].start.kind, 'unknown');
  assert.equal(runs(result, 'reverse')[0].complete_within_route, true);
});

test('unknown access and incomplete route endpoints stay unresolved', () => {
  const input = route();
  input.edges[1].access.forward = decision('unknown', 'Motor access not established');
  input.endpoints.start = { kind: 'unknown', reason: 'Unmatched route continuation' };
  const result = traceRoute(input);
  assert.deepEqual(runs(result).map(run => [run.length_m, run.complete_within_route]), [[100, false], [300, false]]);
  assert.deepEqual(result.excluded.map(item => [item.edge_id, item.status]), [['e1', 'unknown']]);
  assert.equal(runs(result, 'reverse')[0].end.kind, 'unknown');
});

test('explicit destination-only exclusion blocks through cars despite an allowed junction', () => {
  const input = route();
  input.edges[1].access = {
    forward: decision('blocked', 'Destination-only access excludes through cars'),
    reverse: decision('blocked', 'Destination-only access excludes through cars'),
  };
  const result = traceRoute(input);
  assert.deepEqual(runs(result).map(run => run.length_m), [100, 300]);
  assert.deepEqual(runs(result, 'reverse').map(run => run.length_m), [300, 100]);
  assert.equal(result.excluded.length, 2);
});

test('subdividing geometry preserves directional runs, lengths, and boundary meaning', () => {
  const original = traceRoute(route([600]));
  const subdivided = traceRoute(route([40, 60, 200, 300]));
  const semantic = result => result.runs.map(({ edge_ids, ...run }) => run);
  assert.deepEqual(semantic(subdivided), semantic(original));
});

test('opposite directions can use different junction arcs and lengths', () => {
  const input = route([100, 20, 100]);
  input.edges[1].traversals = {forward:{length_m:20},reverse:{length_m:35}};
  const result = traceRoute(input);
  assert.equal(runs(result)[0].length_m,220);
  assert.equal(runs(result,'reverse')[0].length_m,235);
  input.edges[1].traversals.reverse.length_m = NaN;
  assert.throws(() => traceRoute(input),/reverse length/);
});

test('a known prohibition takes precedence over an unknown adjacent edge', () => {
  const input = route([100, 200]);
  input.edges[1].access.forward = decision('unknown', 'Access needs review');
  input.movements[0].forward = decision('blocked', 'Reviewed forced exit from greenway');
  const run = runs(traceRoute(input))[0];
  assert.equal(run.end.kind, 'blocked');
  assert.equal(run.complete_within_route, true);
});

test('missing permissions, malformed topology and invalid distances are rejected', () => {
  for (const mutate of [
    input => { delete input.edges[0].access.reverse; },
    input => { input.edges[0].length_m = -1; },
    input => { input.edges[0].length_m = Infinity; },
    input => { input.edges[1].id = 'e0'; },
    input => { input.movements.pop(); },
    input => { input.movements[0].forward.status = 'probably'; },
    input => { delete input.endpoints.start; },
    input => { input.profile = 'bicycle'; },
  ]) {
    const input = route();
    mutate(input);
    assert.throws(() => traceRoute(input), /Invalid route/);
  }
});
