import test from 'node:test';
import assert from 'node:assert/strict';
import { traceJunction } from './junction-traversal.mjs';

const base = () => ({ way: { id: 5, nodes: [1, 2, 3, 4, 1], coordinates: [[-87,41],[-86.9998,41],[-86.9998,41.0001],[-87,41.0001],[-87,41]], tags: { highway: 'residential', junction: 'roundabout' }, nodeTags: [{},{},{},{},{}] }, fromNode: 1, toNode: 2, fromWayId: 10, toWayId: 20 });
const restriction = (from, via, to, value = 'no_right_turn') => ({ id: 99, tags: { type: 'restriction', restriction: value }, members: [{type:'way',ref:from,role:'from'},{type:'node',ref:via,role:'via'},{type:'way',ref:to,role:'to'}] });
test('roundabout traces distinct directed arcs without repeat laps', () => {
 const result = traceJunction(base());
 assert.equal(result.forward.access.status, 'allowed'); assert.equal(result.reverse.access.status, 'allowed');
 assert.deepEqual(result.forward.geometry.coordinates, [[-87,41],[-86.9998,41]]);
 assert.equal(result.reverse.geometry.coordinates.length, 4); assert.ok(result.reverse.length_m > result.forward.length_m);
 assert.deepEqual(result.forward.access.source_ids, ['way/5']);
});
test('reverse oneway chooses reverse source orientation', () => {
 const input = base(); input.way.tags.oneway = '-1'; const result = traceJunction(input);
 assert.equal(result.forward.geometry.coordinates.length, 4); assert.equal(result.reverse.geometry.coordinates.length, 2);
});
test('same-way no u turn restriction does not forbid continuation', () => {
 const input = base(); input.relations = [restriction(5, 2, 5, 'no_u_turn')];
 assert.equal(traceJunction(input).forward.access.status, 'allowed');
});
test('approach restriction affects only its direction', () => {
 const input = base(); input.relations = [restriction(10, 1, 5)]; const result = traceJunction(input);
 assert.equal(result.forward.access.status, 'blocked'); assert.ok(result.forward.access.source_ids.includes('relation/99'));
 assert.equal(result.reverse.access.status, 'allowed');
});
test('circular without explicit direction is unknown', () => {
 const input = base(); input.way.tags.junction = 'circular'; const result = traceJunction(input);
 assert.equal(result.forward.access.status, 'unknown'); assert.equal(result.reverse.access.status, 'unknown');
});
test('unsupported disconnected and repeated-node geometries return null', () => {
 const input = base(); input.toNode = 44; assert.equal(traceJunction(input), null);
 input.toNode = 2; input.way.nodes = [1,2,3,2,1]; assert.equal(traceJunction(input), null);
});
test('interior barrier yields unknown rather than a full blocked arc', () => {
 const input = base(); input.way.nodeTags[2] = { barrier: 'bollard' }; const result = traceJunction(input);
 assert.equal(result.reverse.access.status, 'unknown'); assert.ok(result.reverse.access.source_ids.includes('node/3'));
 assert.equal(result.forward.access.status, 'allowed');
});
test('two permitted arcs leave route correspondence unknown', () => {
 const input = base(); input.way.tags.oneway = 'no'; const result = traceJunction(input);
 assert.equal(result.forward.access.status, 'unknown'); assert.match(result.forward.access.reason, /ambiguous/);
});

test('split junction retains individual way IDs, directions, and approach restriction', () => {
 const input = base(); const w = input.way; delete input.way;
 input.ways = [
  { ...w, id: 51, nodes: [1,2,3], coordinates: w.coordinates.slice(0,3), nodeTags: [{},{},{}] },
  { ...w, id: 52, nodes: [3,4,1], coordinates: w.coordinates.slice(2), nodeTags: [{},{},{}], tags: {...w.tags, oneway:'yes'} },
 ];
 let result = traceJunction(input);
 assert.equal(result.forward.entry_way_id, 51); assert.equal(result.reverse.entry_way_id, 51);
 assert.equal(result.reverse.exit_way_id, 52); assert.deepEqual(result.reverse.source_way_ids, [51,52]);
 input.relations = [restriction(10,1,51)]; result = traceJunction(input);
 assert.equal(result.forward.access.status, 'blocked'); assert.equal(result.reverse.access.status, 'allowed');
 input.ways[1].tags.oneway = '-1'; result = traceJunction(input);
 assert.equal(result.reverse.access.status, 'unknown'); assert.equal(result.reverse.access.evidence_status, 'conflicting');
});
test('interior only turn makes continuation unknown and preserves evidence', () => {
 const input = base(); input.fromNode = 1; input.toNode = 3;
 input.relations = [restriction(5,2,999,'only_right_turn')];
 const result = traceJunction(input);
 assert.equal(result.forward.access.status,'unknown'); assert.ok(result.forward.access.source_ids.includes('relation/99'));
});
test('interior no U-turn leaves same-way continuation allowed', () => {
 const input = base(); input.toNode = 3; input.relations = [restriction(5,2,5,'no_u_turn')];
 assert.equal(traceJunction(input).forward.access.status,'allowed');
});
test('branching group and disconnected cycles are unsupported', () => {
 const input = base(); input.ways = [input.way, {id:6,nodes:[2,7],coordinates:[[-86.9998,41],[-86.9997,41]],tags:{junction:'roundabout',highway:'residential'}}]; delete input.way;
 assert.equal(traceJunction(input), null);
});
test('blocked alternatives retain evidence from both arcs', () => {
 const input = base(); input.way.tags.oneway = 'no'; input.relations = [restriction(10,1,5)];
 const result = traceJunction(input); assert.equal(result.forward.access.status,'blocked');
 assert.ok(result.forward.access.source_ids.includes('relation/99'));
});

test('inconsistent split one-way circulation makes unsupported blockage conflicting', () => {
 const input = base(), w = input.way; delete input.way;
 input.ways = [
  { ...w, id:51, nodes:[1,2,3], coordinates:w.coordinates.slice(0,3), nodeTags:[{},{},{}] },
  { ...w, id:52, nodes:[1,4,3], coordinates:[w.coordinates[0],w.coordinates[3],w.coordinates[2]], nodeTags:[{},{},{}] },
 ];
 input.toNode = 3;
 const result = traceJunction(input);
 // Both forward arcs are plausible and therefore ambiguous, while neither reverse arc follows its one-way.
 assert.equal(result.reverse.access.status,'unknown'); assert.equal(result.reverse.access.evidence_status,'conflicting');
 assert.deepEqual(new Set(result.reverse.access.source_ids), new Set(['way/51','way/52']));
 input.toNode = 2;
 assert.equal(traceJunction(input).forward.access.status,'allowed');
});
test('coherent circle with prohibited entry remains blocked', () => {
 const input = base(); input.relations = [restriction(10,1,5)];
 assert.equal(traceJunction(input).forward.access.status,'blocked');
});

test('explicit divided-road pair follows each original one-way arm and its restrictions', () => {
 const input=base(), w=input.way; delete input.way; input.toNode=3;
 const metadata={method:'explicit-city-split-carriageway',evidence_id:'bound-pair'};
 const tags={highway:'residential',name:'Example Avenue',oneway:'yes'};
 input.ways=[
  {...w,id:51,nodes:[1,2,3],coordinates:w.coordinates.slice(0,3),nodeTags:[{},{},{}],tags,split_match:metadata},
  {...w,id:52,nodes:[3,4,1],coordinates:w.coordinates.slice(2),nodeTags:[{},{},{}],tags,split_match:metadata},
 ];
 const before=structuredClone(input.ways);
 let result=traceJunction(input);
 assert.deepEqual(result.forward.geometry.coordinates,input.ways[0].coordinates);
 assert.deepEqual(result.reverse.geometry.coordinates,input.ways[1].coordinates);
 assert.equal(result.forward.access.status,'allowed'); assert.equal(result.reverse.access.status,'allowed');
 input.relations=[restriction(20,3,52)]; result=traceJunction(input);
 assert.equal(result.forward.access.status,'allowed'); assert.equal(result.reverse.access.status,'blocked');
 assert.ok(result.reverse.access.source_ids.includes('relation/99'));
 assert.deepEqual(input.ways,before);
 delete input.ways[1].split_match;
 assert.equal(traceJunction(input),null);
});
