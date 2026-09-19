import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const folder = process.argv[2] ?? 'data/sources';
await mkdir(folder, { recursive: true });
const sources = [
 ['greenways.json', 'https://data.cityofchicago.org/resource/hvv9-38ut.json?' + new URLSearchParams({ '$select': ':id,the_geom,street,st_name,oneway_dir,f_street,t_street,displayrou,mi_ctrline,br_oneway,br_ow_dir,contraflow', '$where': "displayrou='Neighborhood Greenway'", '$limit': '5000', '$order': ':id' })],
 ['ward35.geojson', 'https://data.cityofchicago.org/resource/p293-wvbd.geojson?' + new URLSearchParams({ '$where': "ward='35'" })],
 ['bike-routes-metadata.json', 'https://data.cityofchicago.org/api/views/hvv9-38ut.json'],
];
const manifest = [];
for (const [file, url] of sources) {
 const response = await fetch(url); if (!response.ok) throw new Error(`${response.status}: ${url}`);
 const bytes = Buffer.from(await response.arrayBuffer());
 const parsed = JSON.parse(bytes); if (file === 'greenways.json' && parsed.length >= 5000) throw new Error('Pagination required');
 await writeFile(`${folder}/${file}`, bytes);
 manifest.push({ file, url, retrieved_at: new Date().toISOString(), sha256: createHash('sha256').update(bytes).digest('hex'), license: 'City of Chicago data portal terms', license_url: 'https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html' });
}
await writeFile(`${folder}/sources.json`, JSON.stringify(manifest, null, 2));
console.log(`Saved ${manifest.length} source snapshots to ${folder}`);
