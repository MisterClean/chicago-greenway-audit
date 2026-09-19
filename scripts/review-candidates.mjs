import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { lineString, nearestPointOnLine } from '@turf/turf';
import { prepareInventory } from './inventory.mjs';
import { parseScope } from './scope.mjs';
const { scope } = parseScope();
const directory = `data/review/${scope}`;
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const inventory=prepareInventory(await json('data/sources/greenways.json'),scope==='ward35'?(await json('data/sources/ward35.geojson')).features[0]:null);
const db=new DatabaseSync('data/staging/network.sqlite',{readOnly:true});
const query=db.prepare('SELECT w.* FROM way_bounds b JOIN ways w ON w.id=b.id WHERE b.min_lon<=? AND b.max_lon>=? AND b.min_lat<=? AND b.max_lat>=?');
const node=db.prepare('SELECT lon,lat,tags FROM nodes WHERE id=?');
const normalize=s=>(s??'').toUpperCase().replace(/^(NORTH|SOUTH|EAST|WEST|N|S|E|W) /,'').replace(/ (AVENUE|AVE|STREET|ST|ROAD|RD|BOULEVARD|BLVD|DRIVE|DR)$/,'');
const review=[];const relevantWays=new Set();
for(const row of inventory){const xs=row.coordinates.map(p=>p[0]),ys=row.coordinates.map(p=>p[1]);const candidates=[];
 for(const way of query.iterate(Math.max(...xs)+.0003,Math.min(...xs)-.0003,Math.max(...ys)+.0003,Math.min(...ys)-.0003)) {
  const tags=JSON.parse(way.tags);if(!row.sources.some(s=>normalize(s.street)===normalize(tags.name)))continue;
  const ids=JSON.parse(way.nodes);const coords=ids.map(id=>node.get(id)).map(n=>[n.lon,n.lat]);if(coords.length<2)continue;
  const line=lineString(coords);const distances=row.coordinates.map(p=>nearestPointOnLine(line,p,{units:'meters'}).properties.dist);
  if(Math.min(...distances)>25)continue;
  relevantWays.add(way.id);
  candidates.push({way_id:way.id,name:tags.name,endpoint_distances_m:distances.map(d=>Math.round(d*10)/10),covers_both_designation_endpoints:Math.max(...distances)<15,tags,node_ids:ids,geometry:{type:'LineString',coordinates:coords},evidence:`https://www.openstreetmap.org/way/${way.id}`});
 }
 candidates.sort((a,b)=>Math.max(...a.endpoint_distances_m)-Math.max(...b.endpoint_distances_m));
 review.push({sid:row.sid,street:row.sources[0].street,designated_geometry:row.coordinates,gw_mm:row.gw_mm,decision:'unreviewed',reason:'Candidates require overlap/heading, grade, motor direction, barrier, restriction and endpoint review; proximity and name are not approval.',candidates});
}
const restrictions=[];
for(const relation of db.prepare("SELECT * FROM relations WHERE json_extract(tags,'$.type')='restriction'").iterate()) {const members=JSON.parse(relation.members);if(members.some(m=>m.type==='way'&&relevantWays.has(m.ref)))restrictions.push({id:relation.id,tags:JSON.parse(relation.tags),members,decision:'unreviewed'});}
await mkdir(directory,{recursive:true});
await writeFile(`${directory}/matches.json`,JSON.stringify(review,null,2));
await writeFile(`${directory}/restrictions.json`,JSON.stringify(restrictions,null,2));
await writeFile(`${directory}/status.json`,JSON.stringify({scope,intervals:review.length,intervals_with_candidates:review.filter(r=>r.candidates.length).length,candidate_ways:relevantWays.size,restriction_relations:restrictions.length,approved_matches:0,approved_endpoints:0},null,2));
db.close();console.log(await readFile(`${directory}/status.json`,'utf8'));
