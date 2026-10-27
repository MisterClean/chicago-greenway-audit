import test from 'node:test';
import assert from 'node:assert/strict';
import { addScopedRouteWay } from './scoped-route-ways.mjs';
import { shortestPath } from './route-network.mjs';
import { edgeAccess, movementAccess } from './motor-rules.mjs';
const setup = () => ({
 graph:new Map([[1,[]],[3,[]]]),
 way:{id:50,nodes:[0,1,2,3,4],coordinates:[[0,-.001],[0,0],[0,.00005],[0,.0001],[0,.001]],nodeTags:[{},{},{},{},{}],tags:{highway:'residential',oneway:'yes'}},
 binding:{way_id:50,nodes:[1,2,3],city_source_ids:['city']},
 cityRecords:[{':id':'city',oneway_dir:'-',the_geom:{type:'MultiLineString',coordinates:[[[0,0],[0,.0001]]]}}],componentIds:['city']
});
test('adds only the specified bounded path with normal directional and turn decisions', () => {
 const a=setup(), scoped=addScopedRouteWay(a), path=shortestPath(a.graph,1,3);
 assert.deepEqual(scoped.nodes,[1,2,3]); assert.equal(a.graph.has(0),false); assert.equal(a.graph.has(4),false);
 assert.equal(path.length,2); assert.deepEqual(scoped.scoped_match.city_source_ids,['city']);
 assert.equal(edgeAccess(scoped.tags,{reversed:false,nodeTags:[]}).reverse.status,'blocked');
 const relation={id:123,tags:{type:'restriction',restriction:'no_right_turn'},members:[{type:'way',role:'from',ref:60},{type:'node',role:'via',ref:1},{type:'way',role:'to',ref:50}]};
 assert.equal(movementAccess({fromWayId:60,toWayId:50,viaNodeId:1,relations:[relation]}).status,'blocked');
});
test('rejects noncontiguous slices, detached endpoints, other source components and directional assertions', () => {
 let a=setup(); a.binding.nodes=[1,3]; assert.throws(()=>addScopedRouteWay(a),/contiguous/);
 a=setup(); a.graph.delete(3); assert.throws(()=>addScopedRouteWay(a),/attach/);
 a=setup(); a.componentIds=[]; assert.throws(()=>addScopedRouteWay(a),/component/);
 a=setup(); a.cityRecords[0].oneway_dir='E'; assert.throws(()=>addScopedRouteWay(a),/directional/);
});
test('rejects a mid-slice departure even when the endpoints are on city geometry', () => {
 const a=setup(); a.way.coordinates[2]=[.0002,.00005];
 assert.throws(()=>addScopedRouteWay(a),/departs/); assert.equal(a.graph.has(2),false);
});
