import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeAccess, movementAccess } from './motor-rules.mjs';

const statuses = value => [value.forward.status, value.reverse.status];
const relation = (tags, overrides = {}) => ({ id: 99, tags: { type: 'restriction', ...tags }, members: [
  { type: 'way', role: 'from', ref: 1 }, { type: 'node', role: 'via', ref: 2 }, { type: 'way', role: 'to', ref: 3 },
], ...overrides });
const movement = (relations, toWayId = 3) => movementAccess({ fromWayId: 1, viaNodeId: 2, toWayId, relations });

test('more specific car access wins and destination is not a physical barrier', () => {
  const result = edgeAccess({ highway: 'residential', access: 'yes', motor_vehicle: 'destination' });
  assert.deepEqual(statuses(result), ['blocked', 'blocked']);
  assert.equal(result.forward.kind, 'access');
  assert.deepEqual(statuses(edgeAccess({ highway: 'cycleway', access: 'no', motorcar: 'yes' })), ['allowed', 'allowed']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', vehicle: 'no', motor_vehicle: 'yes', motorcar: 'no' })), ['blocked', 'blocked']);
});

test('oneway car modes and reversed geometry are independent from bicycle exceptions', () => {
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' })), ['allowed', 'blocked']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', oneway: '-1' }, { reversed: true })), ['allowed', 'blocked']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', oneway: 'yes', 'oneway:motorcar': 'no' })), ['allowed', 'allowed']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', 'motorcar:forward': 'no' }, { reversed: true })), ['allowed', 'blocked']);
});

test('conditions and unsupported defaults stay unknown while independent prohibitions remain blocked', () => {
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', access: 'yes', 'motor_vehicle:conditional': 'no @ (Mo-Fr)' })), ['unknown', 'unknown']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', oneway: 'yes', 'oneway:conditional': 'no @ (Sa)' })), ['unknown', 'unknown']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', motorcar: 'no', 'oneway:conditional': 'no @ (Sa)' })), ['blocked', 'blocked']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'cycleway' })), ['blocked', 'blocked']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'track' })), ['unknown', 'unknown']);
  assert.deepEqual(statuses(edgeAccess({ highway: 'residential', junction: 'circular' })), ['unknown', 'unknown']);
});

test('interior barriers and node-specific access retain evidence', () => {
  const result = edgeAccess({ highway: 'residential' }, { nodeTags: [{ id: 42, tags: { barrier: 'bollard' } }] });
  assert.equal(result.forward.status, 'blocked');
  assert.equal(result.forward.kind, 'physical');
  assert.deepEqual(result.forward.source_ids, ['node/42']);
  assert.equal(edgeAccess({ highway: 'residential' }, { nodeTags: [{ barrier: 'gate' }] }).forward.status, 'unknown');
  assert.equal(edgeAccess({ highway: 'residential' }, { nodeTags: [{ motorcar: 'destination' }] }).forward.kind, 'access');
});

test('no and only restrictions apply to specific approaches and departures', () => {
  const no = relation({ restriction: 'no_straight_on' });
  assert.equal(movement([no]).status, 'blocked');
  assert.equal(movement([no], 4).status, 'allowed');
  assert.equal(movementAccess({ fromWayId: 8, toWayId: 3, viaNodeId: 2, relations: [no] }).status, 'allowed');
  const only = relation({ restriction: 'only_right_turn' });
  assert.equal(movement([only]).status, 'allowed');
  assert.equal(movement([only], 4).status, 'blocked');
  assert.deepEqual(movement([only], 4).source_ids, ['relation/99']);
});

test('exceptions and modes distinguish bicycles and cars', () => {
  assert.equal(movement([relation({ restriction: 'no_left_turn', except: 'bicycle;bus' })]).status, 'blocked');
  assert.equal(movement([relation({ restriction: 'no_left_turn', except: 'bicycle;motorcar' })]).status, 'allowed');
  assert.equal(movement([relation({ 'restriction:bicycle': 'no_left_turn' })]).status, 'allowed');
  assert.equal(movement([relation({ 'restriction:motorcar': 'no_left_turn' })]).status, 'blocked');
});

test('conditional and via-way restrictions preserve uncertainty', () => {
  assert.equal(movement([relation({ 'restriction:conditional': 'no_left_turn @ (Mo-Fr)' })]).status, 'unknown');
  const viaWay = relation({ restriction: 'no_left_turn' }, { members: [
    { type: 'way', role: 'from', ref: 1 }, { type: 'way', role: 'via', ref: 8 }, { type: 'way', role: 'to', ref: 3 },
  ] });
  assert.equal(movement([viaWay], 8).status, 'unknown');
  assert.equal(movement([viaWay, relation({ restriction: 'no_left_turn' })]).status, 'blocked');
});

test('same-way U-turn is unresolved without directional proof', () => {
  const u = relation({ restriction: 'no_u_turn' }, { members: [
    { type: 'way', role: 'from', ref: 1 }, { type: 'node', role: 'via', ref: 2 }, { type: 'way', role: 'to', ref: 1 },
  ] });
  assert.equal(movement([u], 1).status, 'unknown');
});

test('same-way U-turn restrictions distinguish split-way continuation and reversal', () => {
  const members = [
    { type: 'way', role: 'from', ref: 1 }, { type: 'node', role: 'via', ref: 2 }, { type: 'way', role: 'to', ref: 1 },
  ];
  const evaluate = (rule, isUTurn) => movementAccess({ fromWayId: 1, toWayId: 1, viaNodeId: 2, isUTurn, relations: [relation({ restriction: rule }, { members })] });
  assert.equal(evaluate('no_u_turn', false).status, 'allowed');
  assert.equal(evaluate('no_u_turn', true).status, 'blocked');
  assert.equal(evaluate('only_u_turn', false).status, 'blocked');
  assert.equal(evaluate('only_u_turn', true).status, 'allowed');
  assert.equal(evaluate('only_u_turn', undefined).status, 'unknown');
});

test('a shared endpoint barrier blocks the boundary without excluding adjacent edges', () => {
  const edge = edgeAccess({ highway: 'residential' });
  const boundary = movementAccess({ fromWayId: 1, toWayId: 2, viaNodeId: 42, viaNodeTags: { barrier: 'bollard' } });
  assert.deepEqual(statuses(edge), ['allowed', 'allowed']);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.kind, 'physical');
  assert.deepEqual(boundary.source_ids, ['node/42']);
  assert.equal(movementAccess({ viaNodeId: 42, viaNodeTags: { 'motorcar:forward': 'no' } }).status, 'unknown');
});
