import test from 'node:test';
import assert from 'node:assert/strict';
import { gapReviewContext, inferGapFilter } from './route-evidence.mjs';

test('a gate report annotates only its scoped gap, without authorizing passage', () => {
  const report = {id:'gate',source_record_ids:['city-a'],gap_scope:{route_id:'route-a',bounds:[[-88,41],[-87,42]]},gap_note:'Schedule unknown'};
  const points = [[-87.5,41.5],[-87.5,41.6]];
  assert.deepEqual(gapReviewContext([report],'route-a',['city-a'],points),[report]);
  assert.deepEqual(gapReviewContext([report],'route-b',['city-a'],points),[]);
  assert.deepEqual(gapReviewContext([report],'route-a',['city-b'],points),[]);
  assert.deepEqual(gapReviewContext([report],'route-a',['city-a'],[...points,[-87.5,42.1]]),[]);
  assert.deepEqual(gapReviewContext([report],'route-a',['city-a'],[]),[]);
});

const filterSetup = () => ({
 record:{id:'filter',source_record_ids:['city'],gap_scope:{route_id:'route',bounds:[[-88,41],[-87,42]]},gap_note:'Reported filter',sources:[{url:'https://example.org/installed'},{url:'https://example.org/photo'}],gap_filter:{basis:'reported-installed-filter',reason:'Documented cul-de-sac with cycleway connection; current condition unverified',boundary_node:3,road_way_id:10,cycleway_id:20,supporting_source_urls:['https://example.org/installed','https://example.org/photo'],connection_path:[{way_id:21,nodes:[1,2]},{way_id:20,nodes:[2,3]}]}},
 routeId:'route',sourceIds:['city'],gap:{role:'gap',geometry:{coordinates:[[-87.5,41.5],[-87.5,41.5003]]}},
 before:{way_id:9,to_node:1},after:{way_id:10,from_node:3},road:{id:10,nodes:[3,4]},
 cycleway:{id:20,nodes:[2,3],tags:{highway:'cycleway'}},boundaryNode:{id:3,coordinate:[-87.5,41.5003],tags:{highway:'turning_circle'}},
 connectionWays:[{id:21,nodes:[1,2],coordinates:[[-87.5,41.5],[-87.5,41.5002]]},{id:20,nodes:[2,3],coordinates:[[-87.5,41.5002],[-87.5,41.5003]]}],
 incidentWays:[{id:10,nodes:[3,4],tags:{highway:'residential'}},{id:20,nodes:[2,3],tags:{highway:'cycleway'}}],
});
test('a sideways or detached cycleway and an alternate motor exit cannot establish a through filter', () => {
 for(const mutate of [
  a=>{a.record.gap_filter.connection_path=[{way_id:20,nodes:[2,3]}];},
  a=>{a.connectionWays[0].nodes=[5,2];},
  a=>{a.connectionWays[0].coordinates[1]=[-89,41.5];},
  a=>{a.incidentWays.push({id:30,nodes:[3,5],tags:{highway:'residential'}});},
  a=>{a.incidentWays.push({id:30,nodes:[3,5],tags:{highway:'service','access:conditional':'yes @ (delivery)'}});},
 ]) {const input=filterSetup();mutate(input);assert.throws(()=>inferGapFilter(input),/Gap filter/);}
});
test('installed-filter inference blocks only the scoped gap at its corroborated road endpoint', () => {
 const input=filterSetup(),access=inferGapFilter(input);
 for(const direction of ['forward','reverse']) {assert.equal(access[direction].status,'blocked');assert.equal(access[direction].evidence_status,'source-inferred');assert.deepEqual(access[direction].evidence_ids,['filter']);}
 delete input.record.gap_filter;assert.equal(inferGapFilter(input),null);
});
test('filter inference rejects neighboring scopes, nonterminal nodes, absent sources and conditional car access', () => {
 for(const mutate of [
  a=>{a.routeId='other';},a=>{a.sourceIds=[];},a=>{a.after.from_node=4;},a=>{a.road.nodes=[4,3,5];},a=>{a.boundaryNode.coordinate=[-87.5,41.501];},a=>{a.record.sources.pop();},a=>{a.cycleway.nodes=[2,4];},a=>{a.cycleway.tags.motor_vehicle='yes';},a=>{a.cycleway.tags['motor_vehicle:conditional']='yes @ (delivery)';},
 ]) {const input=filterSetup();mutate(input);assert.throws(()=>inferGapFilter(input),/Gap filter/);}
});
