import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveExplicitRoadMatches } from './explicit-road-matches.mjs';

const input = () => ({
  bindings: [{ route_id: 'carmen-1', city_source_ids: ['spaulding'], way_ids: [8], evidence_id: 'review' }],
  routeId: 'carmen-1', componentIds: ['carmen', 'spaulding'],
  evidenceRecords: [{ id: 'review', source_record_ids: ['spaulding'], way_ids: [8], source_inference: 'The city line follows this Carmen road.', sources: [{ url: 'https://example.org/source' }] }],
  ways: [{ id: 8, nodes: [1, 2], coordinates: [[-87.71, 41.97], [-87.7101, 41.9701]], tags: { name: 'West Carmen Avenue', highway: 'residential', oneway: 'yes', access: 'private' }, nodeTags: [{}, { barrier: 'gate' }] }],
});
test('returns exact evidenced road with source data and permissions preserved', () => {
  const x = input(), before = structuredClone(x), [result] = resolveExplicitRoadMatches(x);
  assert.deepEqual(result.explicit_match, { method: 'explicit-city-road-correspondence', city_source_ids: ['spaulding'], evidence_id: 'review' });
  assert.deepEqual(result.tags, x.ways[0].tags); assert.deepEqual(result.nodes, x.ways[0].nodes);
  assert.deepEqual(result.coordinates, x.ways[0].coordinates); assert.deepEqual(result.nodeTags, x.ways[0].nodeTags);
  assert.deepEqual(x, before);
});
test('requires scope and evidence tying every source and way', () => {
  for (const change of [
    x => { x.bindings[0].city_source_ids = ['outside']; },
    x => { x.evidenceRecords[0].source_record_ids = ['carmen']; },
    x => { x.evidenceRecords[0].way_ids = [9]; },
    x => { x.evidenceRecords[0].sources = []; },
    x => { x.evidenceRecords[0].source_inference = ''; },
    x => { x.bindings[0].evidence_id = 'absent'; },
  ]) { const x = input(); change(x); assert.throws(() => resolveExplicitRoadMatches(x)); }
});
test('rejects invalid, missing, duplicate and non-motor ways', () => {
  for (const change of [
    x => { x.ways = []; }, x => { x.ways.push(x.ways[0]); },
    x => { x.ways[0].tags.highway = 'cycleway'; }, x => { x.ways[0].coordinates[0] = null; },
    x => { x.ways[0].nodes[0] = -1; }, x => { x.bindings[0].way_ids = [8, 8]; },
    x => { x.bindings.push(structuredClone(x.bindings[0])); },
  ]) { const x = input(); change(x); assert.throws(() => resolveExplicitRoadMatches(x)); }
});
test('ignores bindings assigned to other route components', () => {
  const x = input(); x.routeId = 'other'; assert.deepEqual(resolveExplicitRoadMatches(x), []);
});
