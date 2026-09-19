import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const {build_id}=await json('public/current.json');const base=`public/builds/${build_id}`;const manifest=await json(`${base}/manifest.json`);
for(const [name,hash] of Object.entries(manifest.checksums))assert.equal(createHash('sha256').update(await readFile(`${base}/${name}`)).digest('hex'),hash,name);
const expected=new Map((await readFile(`${manifest.normalized_directory??'data/normalized'}/scored/scores.ndjson`,'utf8')).trim().split('\n').map(line=>{const row=JSON.parse(line);return[row.sid,row]}));
const decoded=spawnSync('tippecanoe-decode',[`${base}/greenways.pmtiles`],{encoding:'utf8',maxBuffer:100*1024*1024});assert.equal(decoded.status,0,decoded.stderr);
const seen=new Set();let fragments=0;
function visit(value){if(value.properties?.sid!==undefined){const p=value.properties;const score=expected.get(p.sid);assert.ok(score);for(const name of ['lb_mm','exact','gw_mm'])assert.equal(p[name],score[name],`sid ${p.sid} ${name}`);assert.equal(p.detail_id,p.sid);seen.add(p.sid);fragments++;}for(const f of value.features??[])visit(f);}
visit(JSON.parse(decoded.stdout));assert.equal(seen.size,expected.size);console.log(`Verified all checksums and ${fragments} tile fragments for ${seen.size} unique segments.`);
