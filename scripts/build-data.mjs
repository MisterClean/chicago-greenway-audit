import { readFile, writeFile, mkdir, cp, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { prepareInventory } from './inventory.mjs';
import { reviewedBundle, witnessFor } from './reviewed-bundle.mjs';
import { parseScope } from './scope.mjs';
const { scope, bundleDirectory } = parseScope();
const normalized = `data/normalized/${scope}`;
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=await json('data/sources/sources.json');
for(const source of sources) if(sha(await readFile(`data/sources/${source.file}`))!==source.sha256) throw new Error(`Source checksum mismatch: ${source.file}`);
const rows=await json('data/sources/greenways.json');
const ward=await json('data/sources/ward35.geojson');
const bundle=bundleDirectory?await reviewedBundle(bundleDirectory,sources.find(s=>s.file==='greenways.json').sha256):null;
const inventory=bundle?.inventory??prepareInventory(rows,scope==='ward35'?ward.features[0]:null);
const overrides=await json('data/overrides.json');
if(!bundle&&(overrides.movements.length||overrides.matches.length))throw new Error('Nonempty overrides require an explicit reviewed normalized bundle; they cannot be silently ignored.');
const networkSource=await json('data/sources/osm-source.json');
const candidateRows=await json(`data/review/${scope}/matches.json`);
const candidatesBySid=new Map(candidateRows.map(row=>[row.sid,row]));
for(const row of inventory){const match=candidatesBySid.get(row.sid);if(!bundle&&(!match||JSON.stringify(match.designated_geometry)!==JSON.stringify(row.coordinates)))throw new Error('Candidate inventory differs; regenerate network:review for this scope.');}
const versionSeed=scope+JSON.stringify(bundle)+JSON.stringify(networkSource)+JSON.stringify(candidateRows)+JSON.stringify(sources)+await readFile('data/overrides.json','utf8')+await readFile('scripts/inventory.mjs','utf8')+await readFile('scripts/build-data.mjs','utf8')+await readFile('solver/src/lib.rs','utf8')+await readFile('solver/src/main.rs','utf8')+await readFile('scripts/reviewed-bundle.mjs','utf8');
const buildId=`${scope}-${sources[0].retrieved_at.slice(0,10)}-${sha(versionSeed).slice(0,10)}`;
const out=`public/builds/${buildId}`;
try { await stat(out); throw new Error(`Immutable build already exists: ${out}`); } catch(e) { if(e.code!=='ENOENT') throw e; }
await mkdir(normalized,{recursive:true}); await mkdir(`${out}/details`,{recursive:true});await mkdir(`${out}/runs`,{recursive:true});
// Only normalized, evidenced motor states may enter the solver. Missing states
// are explicitly unresolved, never equivalent to proven motor inaccessibility.
await writeFile(`${normalized}/states.ndjson`,(bundle?.states??[]).map(s=>JSON.stringify(s)).join('\n'));
await writeFile(`${normalized}/segments.ndjson`,(bundle?.segments??inventory.map(r=>({sid:r.sid,gw_mm:r.gw_mm,states:[],directions_resolved:false,inaccessible:false}))).map(s=>JSON.stringify(s)).join('\n')+'\n');
const result=spawnSync('cargo',['run','--release','--locked','--manifest-path','solver/Cargo.toml','--',`${normalized}/states.ndjson`,`${normalized}/segments.ndjson`,`${normalized}/scored`],{stdio:'inherit'});
if(result.status!==0) throw new Error('Solver failed');
const scores=new Map((await readFile(`${normalized}/scored/scores.ndjson`,'utf8')).trim().split('\n').map(line=>{const row=JSON.parse(line);return [row.sid,row]}));
const witnesses=new Map((await readFile(`${normalized}/scored/witnesses.ndjson`,'utf8')).trim().split('\n').filter(Boolean).map(line=>{const row=JSON.parse(line);return [row.state,row]}));
const writtenRuns=new Set();
const features=[]; const audit=[]; const catalog=[];
const sourceMetadata=await json('data/sources/bike-routes-metadata.json');
const effective=sourceMetadata.metadata.custom_fields.Metadata['Time Period'];
for(const row of inventory) {
 const score=scores.get(row.sid); const src=row.sources[0];
 const detail={sid:row.sid,name:src.street,source_cross_streets:`${src.f_street} → ${src.t_street}`,cross_street_note:'Cross streets describe the source designation; the selected interval may cover only part of it.',lb_mm:score.lb_mm,exact:score.exact,gw_mm:row.gw_mm,direction:'Not verified',endpoints:['Upstream street movement not reviewed','Downstream street movement not reviewed'],review_reason:'Street matching, motor access, restrictions, and full corridor endpoints need review. No driving distance has been assigned.',source_date:effective,source_ids:row.sources.map(s=>s[':id']),evidence:[{label:'Official Chicago Bike Routes',url:'https://data.cityofchicago.org/Transportation/Bike-Routes/hvv9-38ut'}],geometry:{type:'LineString',coordinates:row.coordinates}};
 if(bundle){
  detail.review_reason=bundle.review.reason;
  const state=score.controlling_state;
  if(state!==null){
   const metadata=bundle.stateDetails[state];detail.direction=metadata.direction;detail.evidence.push(...metadata.evidence);
   if((witnesses.get(state).flags&4)===0){const run=witnessFor(state,witnesses,bundle.stateDetails);detail.endpoints=[run.first.upstream_reason,run.last.downstream_reason];detail.run_id=run.id;if(!writtenRuns.has(run.id)){await writeFile(`${out}/runs/${run.id}.json`,JSON.stringify(run.geometry));writtenRuns.add(run.id);}}
   else detail.endpoints=['Cycle or path entering a cycle','Requires logical movement review'];
  }else if(score.exact){detail.direction='Ordinary motor access prohibited';detail.endpoints=['Confirmed inaccessible','Confirmed inaccessible'];}
 }else{
  const candidate=candidatesBySid.get(row.sid)?.candidates[0];
  if(candidate)detail.evidence.push({label:'OSM candidate street · not yet approved',url:candidate.evidence});
 }
 await writeFile(`${out}/details/${row.sid}.json`,JSON.stringify(detail));
 features.push({type:'Feature',id:row.sid,properties:{sid:row.sid,lb_mm:score.lb_mm,exact:score.exact,gw_mm:row.gw_mm,detail_id:row.sid},geometry:detail.geometry});
 audit.push({sid:row.sid,street:src.street,source_ids:detail.source_ids,gw_mm:row.gw_mm,lb_mm:score.lb_mm,exact:score.exact,match_status:bundle?'reviewed normalized input':'unreviewed',upstream_reason:detail.endpoints[0],downstream_reason:detail.endpoints[1]});
 catalog.push({sid:row.sid,name:src.street,cross_streets:detail.source_cross_streets,center:row.coordinates[0]});
}
await writeFile(`${normalized}/greenways.geojson`,JSON.stringify({type:'FeatureCollection',features}));
await writeFile(`${normalized}/audit.ndjson`,audit.map(r=>JSON.stringify(r)).join('\n')+'\n');
await writeFile(`${out}/catalog.json`,JSON.stringify(catalog));
await cp(`${normalized}/scored/summary.bin`,`${out}/summary.bin`);
if(scope==='ward35')await cp('data/sources/ward35.geojson',`${out}/ward35.geojson`);
const tile=spawnSync('tippecanoe',['--output',`${out}/greenways.pmtiles`,'--layer','greenways','--minimum-zoom',scope==='city'?'8':'9','--maximum-zoom','16','--no-feature-limit','--no-tile-size-limit','--no-simplification-of-shared-nodes',`${normalized}/greenways.geojson`],{encoding:'utf8',env:{...process.env,TIPPECANOE_MAX_THREADS:'1'}});
if(tile.status!==0) throw new Error(tile.stderr);
const checksums={};
async function visit(dir,prefix='') { for(const entry of await readdir(dir,{withFileTypes:true})) {const name=prefix+entry.name;if(entry.isDirectory()) await visit(`${dir}/${entry.name}`,`${name}/`);else checksums[name]=sha(await readFile(`${dir}/${entry.name}`));} }
await visit(out);
const coordinates=inventory.flatMap(row=>row.coordinates);
const bounds=[[Math.min(...coordinates.map(p=>p[0])),Math.min(...coordinates.map(p=>p[1]))],[Math.max(...coordinates.map(p=>p[0])),Math.max(...coordinates.map(p=>p[1]))]];
const manifest={geographic_scope:scope,scope_label:scope==='city'?'Chicago':'Ward 35',bounds,normalized_directory:normalized,schema_version:1,build_id:buildId,created_at:new Date().toISOString(),as_of:effective,scope:scope==='city'?'All neighborhood greenways in the official Chicago designation snapshot; driving runs continue beyond designation boundaries':'Ward 35 designated mileage only; driving runs must continue beyond the ward',status:bundle?'reviewed-normalized-inventory':'inventory-awaiting-street-review',algorithm:'successor-dp-v1',policy:{straight_degrees:30,other_candidate_min_degrees:60,heading_metres:20,access_profile:'normal passenger car',length_method:'GeographicLib WGS84 geodesic, unsimplified geometry, rounded integer millimetres'},override_version:bundle?.review.override_version??overrides.version,sources,network_source:networkSource,review:bundle?.review??null,comparison_sources:[{url:'https://apps.cnt.org/bikechi/',label:'August 2026 shown on map; inventory reconciliation pending'},{url:'https://chiwho.bike/map/ward/35',label:'Comparison only; not a driving score source'}],segment_count:inventory.length,source_record_count:new Set(inventory.flatMap(r=>r.sources.map(s=>s[':id']))).size,total_designated_mm:inventory.reduce((n,r)=>n+r.gw_mm,0),reviewed_segments:bundle?inventory.length:0,checksums,summary:{encoding:'little-endian',version:1,header_bytes:32,alignment:8},attribution:'Bike routes: City of Chicago. Basemap © OpenStreetMap contributors © CARTO.',limitations:[bundle?'Scores follow the supplied reviewed normalized movements.':'All driving distances are unverified pending street matching and movement review.','December 2025 designation inventory; newer completed projects have not been reconciled.','Source designation cross streets are not driving-run endpoints.'],renderer:{workers:2,maxTileCacheSize:64,pmtiles_directory_cache_entries:16,detail_cache_entries:12}};
await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
await writeFile('public/current.json',JSON.stringify({build_id:buildId}));
console.log(JSON.stringify({buildId,segments:inventory.length,miles:manifest.total_designated_mm/1609344,summary_bytes:(await stat(`${out}/summary.bin`)).size,tiles_bytes:(await stat(`${out}/greenways.pmtiles`)).size}));
