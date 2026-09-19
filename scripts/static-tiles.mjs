import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const {build_id}=JSON.parse(await readFile('public/current.json','utf8'));
const bytes=await readFile(`public/builds/${build_id}/greenways.pmtiles`);
const directory=`public/tile-chunks/${build_id}`;
const chunkSize=65536;
await mkdir(directory,{recursive:true});
const hashes=[];
for(let offset=0,index=0;offset<bytes.length;offset+=chunkSize,index++){
 const chunk=bytes.subarray(offset,offset+chunkSize);
 hashes.push(createHash('sha256').update(chunk).digest('hex'));
 await writeFile(`${directory}/${index}.bin`,chunk);
}
await writeFile(`${directory}/index.json`,JSON.stringify({size:bytes.length,chunkSize,hashes}));
console.log(`Prepared ${hashes.length} static tile chunks (${bytes.length} bytes).`);
