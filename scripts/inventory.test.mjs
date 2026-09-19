import {test} from 'node:test';
import assert from 'node:assert/strict';
import { uniqueIntervals, lengthMm } from './inventory.mjs';
test('duplicate, reversed and partially overlapping designation is counted once',()=>{
 const s={':id':'a'}, t={':id':'b'};
 const parts=uniqueIntervals([{coordinates:[[0,0],[0.002,0]],source:s},{coordinates:[[0.003,0],[0.001,0]],source:t},{coordinates:[[0.002,0],[0,0]],source:s}]);
 assert.equal(parts.length,3);
 assert.ok(Math.abs(parts.reduce((n,p)=>n+lengthMm(p.coordinates),0)-333958)<5);
 assert.equal(parts.filter(p=>p.sources.length===2).length,1);
});

import {prepareInventory} from './inventory.mjs';
import {parseScope} from './scope.mjs';
import {polygon} from '@turf/turf';
import {readFileSync} from 'node:fs';
test('city scope keeps designation beyond pilot boundary; ward scope clips it',()=>{
 const rows=[{':id':'one',the_geom:{type:'MultiLineString',coordinates:[[[0,0],[.003,0]]]}}];
 const ward=polygon([[[0,-.001],[.001,-.001],[.001,.001],[0,.001],[0,-.001]]]);
 const city=prepareInventory(rows);const pilot=prepareInventory(rows,ward);
 assert.ok(city.reduce((s,r)=>s+r.gw_mm,0)>2.9*pilot.reduce((s,r)=>s+r.gw_mm,0));
 assert.equal(city[0].sources[0][':id'],'one');
});
test('city inventory covers every source record, including southern and northern streets',()=>{
 const rows=JSON.parse(readFileSync('data/sources/greenways.json','utf8'));const city=prepareInventory(rows);
 const covered=new Set(city.flatMap(r=>r.sources.map(s=>s[':id'])));
 assert.equal(covered.size,rows.length);
 assert.ok(Math.min(...city.flatMap(r=>r.coordinates.map(p=>p[1])))<41.75);
 assert.ok(Math.max(...city.flatMap(r=>r.coordinates.map(p=>p[1])))>42);
 assert.equal(new Set(city.map(r=>r.sid)).size,city.length);
});
test('scope defaults city and rejects typos without silently clipping data',()=>{
 assert.equal(parseScope([]).scope,'city');
 assert.deepEqual(parseScope(['--scope','ward35','reviewed']),{scope:'ward35',bundleDirectory:'reviewed'});
 assert.throws(()=>parseScope(['--scope','ward53']));
});
