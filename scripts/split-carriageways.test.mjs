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
 const g=fixture(); g.ways[0].coordinates[1]=[0,.001]; g.ways[1].coordinates[1]=[0,.001]; g.cityRecords[0].the_geom.coordinates=[[[0,0],[0,.001]]]; assert.throws(()=>addSplitCarriageway(g),/150 metres/);
});
