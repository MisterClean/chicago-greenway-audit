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
