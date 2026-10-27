import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryTitle, coordinateAtFraction, distanceLabel, longestRun, remainingDistance, type Run, type Route } from './route-model';

const makeRun = (geometry: Run['geometry'], direction: Run['direction'] = 'forward', length_m = 100): Run => ({
  id: direction, direction, geometry, length_m, edge_ids: [],
  start: { kind: 'unknown', reason: 'Unknown source gap' },
  end: { kind: 'scope_end', reason: 'End of mapped greenway' },
  complete_within_route: false, scope_limited: true, evidence_status: 'source-inferred',
});
const near = (actual: number, expected: number, tolerance = 0.1) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test('distance labels do not round positive short distances to zero', () => {
  assert.equal(distanceLabel(1), '<0.01 mi');
  assert.equal(distanceLabel(10), '<0.01 mi');
  assert.equal(distanceLabel(0), '0.00 mi');
  assert.equal(distanceLabel(676), '0.42 mi');
});

test('longest run respects the selected direction', () => {
  const small = makeRun({ type: 'LineString', coordinates: [[0, 0], [1, 0]] }, 'forward', 10);
  const big = makeRun(small.geometry, 'forward', 20);
  const reverse = makeRun(small.geometry, 'reverse', 30);
  const route = { runs: [small, reverse, big] } as Route;
  assert.equal(longestRun(route, 'forward'), big);
  assert.equal(longestRun(route, 'reverse'), reverse);
  assert.equal(longestRun({ runs: [] } as unknown as Route, 'forward'), undefined);
});

test('projection follows oriented geometry for both directions', () => {
  const forward = makeRun({ type: 'LineString', coordinates: [[-87.7, 41.9], [-87.7, 41.91]] });
  const reverse = makeRun({ type: 'LineString', coordinates: [[-87.7, 41.91], [-87.7, 41.9]] }, 'reverse');
  const click: [number, number] = [-87.7, 41.9025];
  near(remainingDistance(forward, click)!.remaining_m, 75);
  near(remainingDistance(reverse, click)!.remaining_m, 25);
  near(remainingDistance(forward, [-87.7, 41.905])!.remaining_m, 50);
});

test('projection follows bends instead of measuring the straight chord', () => {
  const run = makeRun({ type: 'LineString', coordinates: [[-87.7, 41.9], [-87.7, 41.901], [-87.699, 41.901]] });
  const result = remainingDistance(run, [-87.7, 41.901])!;
  assert.ok(result.offset_m > 50 && result.offset_m < 60);
  assert.ok(result.remaining_m > 40 && result.remaining_m < 50);
  near(result.distance_to_line_m, 0, 0.001);
});

test('multiline segments never count gaps as traveled distance', () => {
  const run = makeRun({ type: 'MultiLineString', coordinates: [
    [[-87.7, 41.9], [-87.7, 41.901]],
    [[-87.7, 41.91], [-87.7, 41.911]],
  ] });
  near(remainingDistance(run, [-87.7, 41.901])!.remaining_m, 50);
  near(remainingDistance(run, [-87.7, 41.9105])!.remaining_m, 25);
  assert.equal(remainingDistance(makeRun({ type: 'LineString', coordinates: [] }), [-87.7, 41.9]), undefined);
});

test('boundaries do not conflate a map endpoint with blocked or unknown', () => {
  assert.equal(boundaryTitle({ kind: 'scope_end', reason: 'Route ends' }), 'End of mapped greenway');
  assert.equal(boundaryTitle({ kind: 'unknown', reason: 'Missing data' }), 'Continuation unknown');
  assert.equal(boundaryTitle({ kind: 'blocked', reason: 'No entry' }), 'Car continuation blocked');
});

test('keyboard positions follow travel direction and exclude gaps', () => {
  const run = makeRun({type:'MultiLineString', coordinates:[[[0,0],[0,0.001]],[[0,0.01],[0.001,0.01]]]});
  const point = coordinateAtFraction(run,0.75)!;
  near(point[0],0.0005,0.00001);
  near(point[1],0.01,0.00001);
  near(remainingDistance(run,point)!.remaining_m,25);
  assert.deepEqual(coordinateAtFraction(run,-1),[0,0]);
  assert.deepEqual(coordinateAtFraction(run,2),[0.001,0.01]);
  assert.equal(coordinateAtFraction(run,NaN),undefined);
  const reverse = makeRun({type:'LineString',coordinates:[[0,0.001],[0,0]]},'reverse');
  near(coordinateAtFraction(reverse,0.25)![1],0.00075,0.000001);
});
