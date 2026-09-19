import {test} from 'node:test';
import assert from 'node:assert/strict';
import {witnessFor} from './reviewed-bundle.mjs';
test('witness contains full controlling path and retains endpoint evidence',()=>{
 const pointers=new Map([[0,{predecessor:null,next:2}],[1,{predecessor:null,next:2}],[2,{predecessor:1,next:3}],[3,{predecessor:2,next:null}]]);
 const details=Object.fromEntries([0,1,2,3].map(id=>[id,{upstream_reason:`start ${id}`,downstream_reason:`end ${id}`,geometry:{type:'LineString',coordinates:[[id,0],[id+1,0]]}}]));
 const witness=witnessFor(3,pointers,details);
 assert.deepEqual(witness.geometry.features.map(f=>f.properties.state),[1,2,3]);
 assert.equal(witness.first.upstream_reason,'start 1');assert.equal(witness.last.downstream_reason,'end 3');
 assert.throws(()=>witnessFor(0,new Map([[0,{predecessor:null,next:0}]]),details));
});
