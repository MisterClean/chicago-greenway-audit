import test from 'node:test';
import assert from 'node:assert/strict';
import { alignedGraph } from './route-network.mjs';

const point = x => [-87.7+x/83100, 41.97];
const street = (nodes, xs, extra = {}) => ({ id: 9, nodes, coordinates: xs.map(point), tags: { highway: 'residential' }, ...extra });
const matching = lines => ({ explicit_match: { method: 'explicit-city-road-correspondence' }, match_lines: lines });

test('explicit roads only enter graph along their bound city row', () => {
  const city = [point(0),point(100),point(200)];
  const bound = [[point(0),point(100)]];
  const graph = alignedGraph(city,[street([1,2,3],[0,100,200],matching(bound))],18);
  assert.equal(graph.get(1)?.some(e=>e.to===2),true);
  assert.equal(graph.get(2)?.some(e=>e.to===3),false);
  const normal = alignedGraph(city,[street([1,2,3],[0,100,200])],18);
  assert.equal(normal.get(2)?.some(e=>e.to===3),true);
});
test('requires well-formed bound lines for every explicit road even if it would not match', () => {
  const city=[point(0),point(100)];
  for (const lines of [undefined, [], [[point(0)]], [[point(0),[NaN,41]]], [[point(0),point(0)]]]) {
    assert.throws(()=>alignedGraph(city,[street([1,2],[0,100],matching(lines))]),/match_lines/);
  }
});
test('samples between endpoints and midpoint to catch departure from bound geometry', () => {
  const city=[point(0),point(100)];
  // Each endpoint and the midpoint are near an evidence-bound fragment; the
  // first and third quarters are more than 18 m from every fragment.
  const bounds=[[point(0),point(1)],[point(49),point(51)],[point(99),point(100)]];
  const normal=alignedGraph(city,[street([1,2],[0,100])]);
  assert.equal(normal.get(1)?.some(e=>e.to===2),true);
  const scoped=alignedGraph(city,[street([1,2],[0,100],matching(bounds))]);
  assert.equal(scoped.size,0);
});
