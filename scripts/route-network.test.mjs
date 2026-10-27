import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, alignedGraph, shortestPath, compareCityOneWay, clipTerminal, acceptsUnnamedWay, designationRecords, joinForReview } from './route-network.mjs';
const record=(id,coords)=>({':id':id,the_geom:{coordinates:[coords]}});
test('documented review connection preserves designated mileage and rejects unrelated or unbound joins', () => {
 const west=[[-87.646,41.94],[-87.644,41.94]],east=[[-87.644,41.9403],[-87.64,41.9403]];
 const parts=[{coords:west,ids:['west']},{coords:east,ids:['east']}];
 const binding={from_source_id:'west',to_source_id:'east',evidence_id:'jog',max_distance_m:40};
 const evidence=[{id:'jog',source_record_ids:['west','east']}];
 const [joined]=joinForReview(parts,binding,evidence);
 assert.deepEqual(joined.designationLines,[west,east]);
 assert.deepEqual(joined.connector,[west.at(-1),east[0]]);
 assert.equal(joined.connection_evidence_id,'jog');
 assert.equal(parts.length,2);
 assert.throws(()=>joinForReview(parts,binding,[]),/evidence bound/);
 assert.throws(()=>joinForReview(parts,{...binding,max_distance_m:10},evidence),/distance bound/);
 assert.throws(()=>joinForReview(parts,{...binding,to_source_id:'west'},evidence),/distinct/);
 assert.throws(()=>joinForReview([parts[0],{coords:west,ids:['other']},parts[1]],binding,evidence),/adjacent/);
});
test('explicit designation alias includes the typo without rewriting or fuzzy matching source records', () => {
 const source=[{':id':'west',st_name:'BERWN'},{':id':'east',st_name:'BERWYN'},{':id':'other',st_name:'BERWYNNE'}];
 const selected=designationRecords(source,{source:'BERWYN',source_aliases:['BERWN']});
 assert.deepEqual(selected.map(r=>r[':id']),['west','east']);
 assert.equal(selected[0],source[0]); assert.equal(selected[0].st_name,'BERWN');
 assert.deepEqual(designationRecords(source,{source:'BERWYN'}).map(r=>r[':id']),['east']);
 assert.throws(()=>designationRecords(source,{source:'MISSING'}),/No designation/);
});
test('assembles connected records with consistent route orientation and retains gaps',()=>{
 const parts=assemble([record('a',[[0,0],[0,0.001]]),record('b',[[0,0.002],[0,0.001]]),record('c',[[0,0.004],[0,0.005]])],'north');
 assert.equal(parts.length,2);assert.deepEqual(parts[0].coords,[[0,0],[0,0.001],[0,0.002]]);assert.deepEqual(new Set(parts[0].ids),new Set(['a','b']));
});
test('crossing geometries do not connect without a shared OSM node',()=>{
 const line=[[0,0],[0.002,0]];const ways=[{id:1,nodes:[1,2],coordinates:[[0,0],[0.001,0]]},{id:2,nodes:[3,4],coordinates:[[0.001,0],[0.002,0]]}];
 const graph=alignedGraph(line,ways);assert.equal(shortestPath(graph,1,4),null);
});
test('rejects an off-route parallel bypass and preserves route order',()=>{
 const line=[[0,0],[0.002,0]],ways=[{id:1,nodes:[1,2,3],coordinates:[[0,0],[0.001,0],[0.002,0]]},{id:2,nodes:[1,4,3],coordinates:[[0,0],[0.001,0.001],[0.002,0]]}];
 const graph=alignedGraph(line,ways);assert.deepEqual(shortestPath(graph,1,3).map(e=>e.way.id),[1,1]);assert.deepEqual(shortestPath(graph,3,1).map(e=>e.reversed),[true,true]);
});

test('matches a bounded diagonal between existing nodes at a city jog',()=>{
 const line=[[0,0],[0,0.0001],[-0.0001,0.0001],[-0.0001,0.0002]];
 const ways=[{id:1,nodes:[1,2],coordinates:[[0,0],[0,0.00005]]},{id:2,nodes:[2,3],coordinates:[[0,0.00005],[-0.0001,0.00015]]},{id:3,nodes:[3,4],coordinates:[[-0.0001,0.00015],[-0.0001,0.0002]]}];
 assert.deepEqual(shortestPath(alignedGraph(line,ways),1,4).map(e=>e.way.id),[1,2,3]);
 const isolated=[...ways,{id:4,nodes:[2,5],coordinates:[[0,0.00005],[-0.00009,0.00014]]}];
 assert.equal(alignedGraph(line,isolated).has(5),false);
});

test('matches both sides of a small split circular junction using shared nodes',()=>{
 const line=[[0,0],[0,0.0003]],circle={junction:'circular'};
 const ways=[{id:1,nodes:[1,2],coordinates:[[0,0],[0,0.0001]]},{id:2,nodes:[2,3,4],coordinates:[[0,0.0001],[-0.00005,0.00015],[0,0.0002]],tags:circle},{id:3,nodes:[4,5,2],coordinates:[[0,0.0002],[0.00005,0.00015],[0,0.0001]],tags:circle},{id:4,nodes:[4,6],coordinates:[[0,0.0002],[0,0.0003]]}];
 const graph=alignedGraph(line,ways);assert.ok(shortestPath(graph,1,6));assert.ok(graph.get(2).some(e=>e.to===5));assert.ok(graph.get(4).some(e=>e.to===3));
 const tooLarge=alignedGraph(line,ways,2);assert.equal(shortestPath(tooLarge,1,6),null);
});

test('unnamed tertiary junctions reach bounded graph matching, unlike ordinary tertiary roads',()=>{
 assert.equal(acceptsUnnamedWay({highway:'tertiary',junction:'circular'}),true);
 assert.equal(acceptsUnnamedWay({highway:'tertiary',junction:'roundabout'}),true);
 assert.equal(acceptsUnnamedWay({highway:'tertiary'}),false);
 assert.equal(acceptsUnnamedWay({junction:'circular'}),false);
});

test('pilot export preserves source components, known restrictions and unreviewed evidence',async()=>{
 const {readFile}=await import('node:fs/promises');const data=JSON.parse(await readFile('public/routes/pilot.json','utf8'));
 assert.equal(data.schema_version,1);assert.equal(data.summary.reviewed_movements,0);
 for(const route of data.routes){assert.equal(route.coverage.reviewed_movements,0);assert.ok(route.source_ids.length);assert.ok(Math.abs(route.coverage.designated_m-route.coverage.matched_m-route.coverage.unknown_m)<0.01);for(const run of route.runs){assert.equal(run.evidence_status,'source-inferred');assert.ok(run.start.coordinate);assert.ok(run.end.coordinate);}for(const e of route.edges)if(e.role==='gap'){assert.equal(e.way_id,null);for(const direction of ['forward','reverse']){const access=e.access[direction];assert.notEqual(access.status,'allowed');if(access.status==='blocked'){assert.equal(route.id,'leavitt-2');assert.equal(access.kind,'physical');assert.ok(access.evidence_ids.includes('leavitt-montrose-lincoln-cul-de-sac'));assert.ok(access.source_ids.includes('node/1258927214'));}else assert.equal(access.status,'unknown');}}}
 const leland=data.routes.find(r=>r.name==='Leland');assert.equal(leland.geometry.type,'MultiLineString');assert.ok(leland.movements.some(m=>m.forward.status==='blocked'&&m.forward.source_ids?.includes('relation/20163015')));
 const dickens=data.routes.find(r=>r.name==='Dickens');assert.equal(dickens.geometry.type,'MultiLineString');assert.ok(dickens.events.some(e=>e.evidence_urls.includes('https://www.openstreetmap.org/way/1237331792')));assert.ok(dickens.edges.some(e=>e.access.forward.evidence_status==='conflicting'));assert.ok(dickens.edges.some(e=>e.role==='connector'&&e.access.forward.status==='unknown'));
 assert.ok(data.routes.some(r=>r.name==='Berteau'&&r.edges.some(e=>e.way_id===1088397391&&e.access.forward.status==='unknown')));
 const wood=data.routes.find(r=>r.id==='wood-2');
 const augusta=wood.movements.find(m=>m.cross_street==='West Augusta Boulevard');
 assert.equal(augusta.forward.status,'allowed');assert.equal(augusta.reverse.status,'allowed');
 const conversion=wood.edges.filter(e=>e.way_id===1444797397);
 assert.ok(conversion.length);
 for(const edge of conversion){assert.equal(edge.access.forward.status,'blocked');assert.equal(edge.access.forward.kind,'direction');assert.equal(edge.access.reverse.status,'allowed');assert.ok(edge.evidence_urls.includes('https://www.the1stward.com/woodst'));assert.match(edge.access.forward.reason,/two-way bicycle access/);}
 assert.ok(wood.events.some(e=>e.kind==='direction'&&e.evidence_urls.includes('https://www.the1stward.com/woodst')));
 assert.ok(wood.edges.filter(e=>e.way_id===1290364169).every(e=>!e.evidence_urls.includes('https://www.the1stward.com/woodst')));
});


test('opposite explicit city and OSM one-ways make both directions conflicting',()=>{
 const osm={forward:{status:'allowed',kind:'open',reason:'oneway=yes follows way'},reverse:{status:'blocked',kind:'direction',reason:'oneway=yes prohibits reverse'}};
 const result=compareCityOneWay(osm,'S','north');
 assert.equal(result.forward.status,'unknown');assert.equal(result.reverse.status,'unknown');
 assert.equal(result.forward.evidence_status,'conflicting');assert.equal(result.reverse.evidence_status,'conflicting');
 const unrestricted={forward:osm.forward,reverse:{status:'allowed',kind:'open',reason:'No car one-way restriction inferred'}};
 const partial=compareCityOneWay(unrestricted,'S','north');assert.equal(partial.forward.status,'unknown');assert.equal(partial.reverse.status,'allowed');
});

test('clips terminal geometries at the projected source endpoint',()=>{
 const coords=[[0,0],[0.001,0],[0.002,0]];
 const end=clipTerminal(coords,[0.0019,0.00001],'end');assert.equal(end.resolved,true);assert.ok(Math.abs(end.coords.at(-1)[0]-0.0019)<1e-9);
 const start=clipTerminal(coords,[0.0001,0.00001],'start');assert.equal(start.resolved,true);assert.ok(Math.abs(start.coords[0][0]-0.0001)<1e-9);
 assert.equal(clipTerminal(coords,[0.001,0.01],'start').resolved,false);
 const stateApproach=[[-87.6224877,41.6689253],[-87.6223508,41.6689268]];
 const stateEnd=clipTerminal(stateApproach,[-87.62234490640415,41.66891114918197],'end');
 assert.equal(stateEnd.resolved,true);assert.deepEqual(stateEnd.coords.at(-1),stateApproach.at(-1));
});
