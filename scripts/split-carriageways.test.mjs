import test from 'node:test';
import assert from 'node:assert/strict';
import { addSplitCarriageway } from './split-carriageways.mjs';
import { edgeAccess } from './motor-rules.mjs';

function fixture() {
  const road = {id:90,tags:{highway:'residential',name:'North Main Avenue'},nodes:[0,1]};
  const other = {id:91,tags:{highway:'residential',name:'North Main Avenue'},nodes:[3,4]};
  const ways = [
    {id:10,nodes:[1,2,3],coordinates:[[0,0],[.00002,.0001],[0,.0002]],nodeTags:[{},{},{}],tags:{highway:'residential',name:'North Main Avenue',oneway:'yes','oneway:bicycle':'no'}},
    {id:20,nodes:[3,5,1],coordinates:[[0,.0002],[-.00002,.0001],[0,0]],nodeTags:[{},{},{}],tags:{highway:'residential',name:'North Main Avenue',oneway:'yes',motor_vehicle:'destination'}}
  ];
  return {graph:new Map([[1,[{way:road,to:0}]],[3,[{way:other,to:4}]]]),ways,binding:{way_ids:[10,20],city_source_ids:['city'],evidence_id:'e'},cityRecords:[{':id':'city',the_geom:{type:'MultiLineString',coordinates:[[[0,0],[0,.0002]]]}}],componentIds:['city'],evidenceRecords:[{id:'e',way_ids:[10,20],source_record_ids:['city']}],incidentWays:[...ways,road,other]};
}
test('adds both directions of both arms and retains OSM access rules',()=>{
 const f=fixture(); const result=addSplitCarriageway(f);
 assert.equal(result.length,2); assert.equal(result[0].split_match.method,'explicit-city-split-carriageway');
 assert.equal(result[0].tags,f.ways[0].tags); assert.equal(result[1].tags.motor_vehicle,'destination');
 assert.equal(edgeAccess(result[0].tags).reverse.status,'blocked'); assert.equal(edgeAccess(result[1].tags).forward.status,'blocked');
 assert.equal(f.graph.get(1).filter(e=>e.way.id===10).length,1); assert.equal(f.graph.get(2).filter(e=>e.way.id===10).length,2);
 addSplitCarriageway(f); assert.equal(f.graph.get(2).filter(e=>e.way.id===10).length,2);
});
test('rejects invalid bindings, topology, geometry, attachment and branch without graph mutation',()=>{
 const cases=[
  f=>f.componentIds=[],
  f=>f.binding.way_ids=[10,10],
  f=>f.ways[1].nodes=[1,5,3],
  f=>f.ways[1].nodes=[3,2,1],
  f=>f.ways[0].nodes=[1,2,2,3],
  f=>f.ways[0].coordinates[1]=[.001,.0001],
  f=>f.graph.delete(3),
  f=>f.incidentWays.push({id:40,nodes:[2,7],tags:{highway:'service'}}),
  f=>delete f.ways[0].tags.name,
  f=>f.evidenceRecords[0].way_ids=[10],
  f=>f.evidenceRecords[0].source_record_ids=[],
  f=>f.ways[1].tags.oneway='no',
  f=>f.ways[1].tags.name='Other',
  f=>f.cityRecords[0].the_geom.coordinates=[[[.01,0],[.01,.0002]]],
 ];
 for (const mutate of cases) { const f=fixture(); mutate(f); const before=JSON.stringify([...f.graph]); assert.throws(()=>addSplitCarriageway(f)); assert.equal(JSON.stringify([...f.graph]),before); }
});
test('accepts nonmotor interior paths but rejects long combined arms',()=>{
 const f=fixture(); f.incidentWays.push({id:40,nodes:[2,7],tags:{highway:'cycleway'}}); assert.equal(addSplitCarriageway(f).length,2);
 const g=fixture(); g.ways[0].coordinates[1]=[0,.001]; g.ways[1].coordinates[1]=[0,.001]; g.cityRecords[0].the_geom.coordinates=[[[0,0],[0,.001]]]; assert.throws(()=>addSplitCarriageway(g),/250 metres/);
});

function multiway() {
 const f=fixture(), first=f.ways[0];
 f.ways=[{...first,id:10,nodes:[1,2],coordinates:first.coordinates.slice(0,2),nodeTags:[{},{}]},
   {...first,id:11,nodes:[2,3],coordinates:first.coordinates.slice(1),nodeTags:[{},{}]},f.ways[1]];
 f.binding.way_ids=[10,11,20]; f.binding.arms=[[10,11],[20]];
 f.evidenceRecords[0].way_ids=[10,11,20]; f.incidentWays=[...f.ways];
 return f;
}
test('multiway arms preserve source order, ways and unchanged rules',()=>{
 const f=multiway(); const tags=JSON.stringify(f.ways.map(w=>w.tags));
 const result=addSplitCarriageway(f);
 assert.deepEqual(result.map(w=>w.id),[10,11,20]);
 assert.equal(JSON.stringify(f.ways.map(w=>w.tags)),tags);
 assert.equal(f.graph.get(2).filter(e=>e.way.id===11).length,1);
 assert.equal(edgeAccess(result[2].tags).forward.status,'blocked');
});
test('rejects incorrect arms and overlapping nodes before mutation',()=>{
 const changes=[
  f=>f.binding.arms=[[11,10],[20]],
  f=>f.binding.arms=[[10],[20]],
  f=>f.binding.arms=[[10,11],[11,20]],
  f=>{f.ways[2].nodes=[3,2,1];},
  f=>{f.ways[1].coordinates[0]=[.0001,.0001];}
 ];
 for (const change of changes) {const f=multiway();change(f);const before=JSON.stringify([...f.graph]);assert.throws(()=>addSplitCarriageway(f));assert.equal(JSON.stringify([...f.graph]),before);}
});
test('reviewed branches require exact inventory and matching evidence; never add branch edges',()=>{
 const f=multiway(); f.incidentWays.push({id:40,nodes:[2,7],tags:{highway:'residential'}});
 f.binding.reviewed_branches=[{node_id:2,way_ids:[40],evidence_id:'branch'}];
 f.evidenceRecords.push({id:'branch',way_ids:[10,11,20,40],source_record_ids:['city']});
 const result=addSplitCarriageway(f); assert.equal(result.length,3);
 assert.ok(![...f.graph.values()].flat().some(e=>e.way.id===40));
 for (const change of [
   x=>x.binding.reviewed_branches[0].way_ids=[41],
   x=>x.binding.reviewed_branches[0].way_ids=[40,41],
   x=>x.binding.reviewed_branches.push({...x.binding.reviewed_branches[0]}),
   x=>x.binding.reviewed_branches[0].node_id=1,
   x=>x.evidenceRecords[1].way_ids=[10,11,40],
   x=>x.evidenceRecords[1].source_record_ids=[],
   x=>x.binding.reviewed_branches=[],
 ]) {const x=multiway();x.incidentWays.push({id:40,nodes:[2,7],tags:{highway:'residential'}});x.binding.reviewed_branches=[{node_id:2,way_ids:[40],evidence_id:'branch'}];x.evidenceRecords.push({id:'branch',way_ids:[10,11,20,40],source_record_ids:['city']});change(x);const before=JSON.stringify([...x.graph]);assert.throws(()=>addSplitCarriageway(x));assert.equal(JSON.stringify([...x.graph]),before);}
});

test('accepts a bounded loop longer than the old 150 metre cap',()=>{
 const f=fixture(); f.ways[0].coordinates=[[0,0],[.00002,.0005],[0,.001]];
 f.ways[1].coordinates=[[0,.001],[-.00002,.0005],[0,0]];
 f.cityRecords[0].the_geom.coordinates=[[[0,0],[0,.001]]];
 assert.equal(addSplitCarriageway(f).length,2);
});

test('removes preexisting reviewed branch edges without removing other roads',()=>{
 const f=multiway();
 const branch={id:40,nodes:[2,7],tags:{highway:'residential',name:'North Main Avenue'}};
 const other={id:41,nodes:[7,8],tags:{highway:'residential'}};
 f.incidentWays.push(branch);
 f.binding.reviewed_branches=[{node_id:2,way_ids:[40],evidence_id:'branch'}];
 f.evidenceRecords.push({id:'branch',way_ids:[10,11,20,40],source_record_ids:['city']});
 f.graph.set(2,[{way:branch,to:7}]);
 f.graph.set(7,[{way:branch,to:2},{way:other,to:8}]);
 f.graph.set(8,[{way:other,to:7}]);
 f.graph.set(9,[{way:branch,to:2}]);
 addSplitCarriageway(f);
 assert.ok(![...f.graph.values()].flat().some(e=>e.way.id===40));
 assert.equal(f.graph.get(7)[0].way.id,41);
 assert.equal(f.graph.get(8)[0].way.id,41);
 assert.equal(f.graph.has(9),false);
});
test('does not mutate graph when reviewed branch is sole endpoint attachment',()=>{
 const f=multiway();
 const branch={id:40,nodes:[1,2,7],tags:{highway:'residential'}};
 f.incidentWays.push(branch);
 f.binding.reviewed_branches=[{node_id:2,way_ids:[40],evidence_id:'branch'}];
 f.evidenceRecords.push({id:'branch',way_ids:[10,11,20,40],source_record_ids:['city']});
 f.graph.set(1,[{way:branch,to:2}]);
 const before=JSON.stringify([...f.graph]);
 assert.throws(()=>addSplitCarriageway(f),/attachment/);
 assert.equal(JSON.stringify([...f.graph]),before);
});
