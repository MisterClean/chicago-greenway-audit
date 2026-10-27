import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, alignedGraph, shortestPath, compareCityOneWay, clipTerminal } from './route-network.mjs';
const record=(id,coords)=>({':id':id,the_geom:{coordinates:[coords]}});
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

test('pilot export preserves source components, known restrictions and unreviewed evidence',async()=>{
 const {readFile}=await import('node:fs/promises');const data=JSON.parse(await readFile('public/routes/pilot.json','utf8'));
 assert.equal(data.schema_version,1);assert.equal(data.summary.reviewed_movements,0);
 for(const route of data.routes){assert.equal(route.coverage.reviewed_movements,0);assert.ok(route.source_ids.length);assert.ok(Math.abs(route.coverage.designated_m-route.coverage.matched_m-route.coverage.unknown_m)<0.01);for(const run of route.runs){assert.equal(run.evidence_status,'source-inferred');assert.ok(run.start.coordinate);assert.ok(run.end.coordinate);}for(const e of route.edges)if(e.role==='gap'){assert.equal(e.way_id,null);assert.equal(e.access.forward.status,'unknown');assert.equal(e.access.reverse.status,'unknown');}}
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
});
