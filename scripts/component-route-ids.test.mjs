import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentRouteIds } from './component-route-ids.mjs';

test('preserves a known URL after earlier components merge', () => {
  const components = [{ ids: ['a', 'b', 'connector'] }, { ids: ['row-5h7z.m2fp_7gx2'] }];
  assert.deepEqual(componentRouteIds(components, 'berteau', [{ source_id: 'row-5h7z.m2fp_7gx2', route_id: 'berteau-3' }]), ['berteau-1', 'berteau-3']);
  assert.deepEqual(componentRouteIds(components, 'berteau'), ['berteau-1', 'berteau-2']);
});
test('rejects missing, duplicate and ambiguous anchors', () => {
  const components = [{ids:['a','b']},{ids:['c']}];
  for (const bindings of [[{source_id:'missing',route_id:'r-3'}], [{source_id:'a',route_id:'r-3'},{source_id:'a',route_id:'r-4'}], [{source_id:'a',route_id:'r-3'},{source_id:'b',route_id:'r-4'}]]) assert.throws(() => componentRouteIds(components,'r',bindings));
  assert.throws(() => componentRouteIds([{ids:['a']},{ids:['a']}], 'r', []));
});
test('rejects invalid IDs and collisions with defaults or other bindings', () => {
  const components = [{ids:['a']},{ids:['b']}];
  for (const id of ['wrong-3','r-0','r-01','r--1','r-1.5','r-9007199254740992']) assert.throws(() => componentRouteIds(components,'r',[{source_id:'a',route_id:id}]));
  assert.throws(() => componentRouteIds(components,'r',[{source_id:'a',route_id:'r-2'}]));
  assert.throws(() => componentRouteIds(components,'r',[{source_id:'a',route_id:'r-3'},{source_id:'b',route_id:'r-3'}]));
});
test('rejects malformed components and prefixes', () => {
  assert.throws(() => componentRouteIds([{ids:[]}],'r'));
  assert.throws(() => componentRouteIds([{ids:['a','a']}],'r'));
  assert.throws(() => componentRouteIds([{ids:['a']}],''));
  assert.deepEqual(componentRouteIds([], 'r'), []);
});
