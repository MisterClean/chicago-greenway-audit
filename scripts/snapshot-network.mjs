import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Complete ways and relation members, not clipped polylines. Boundary nodes remain open.
const query = '[out:json][timeout:180];(way[highway](41.89,-87.80,42.01,-87.65);relation[type=restriction](41.89,-87.80,42.01,-87.65););(._;>>;);out body;';
const url='https://overpass.kumi.systems/api/interpreter';
const response=await fetch(url+'?'+new URLSearchParams({data:query}),{signal:AbortSignal.timeout(240000)});
if(!response.ok) throw new Error(`OSM snapshot failed: ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer()); const data=JSON.parse(bytes);
if(data.remark) throw new Error(data.remark);
await writeFile('data/sources/osm.json',bytes);
await writeFile('data/sources/osm-source.json',JSON.stringify({url,query,retrieved_at:new Date().toISOString(),effective_date:data.osm3s.timestamp_osm_base,sha256:createHash('sha256').update(bytes).digest('hex'),license:'ODbL 1.0',license_url:'https://www.openstreetmap.org/copyright'},null,2));
console.log(`Saved ${data.elements.length} OSM elements (${bytes.length} bytes)`);
