import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PMTiles} from 'pmtiles';
import {StaticTileSource} from './static-tile-source';

const {build_id}=JSON.parse(readFileSync('public/current.json','utf8'));
const archive=readFileSync(`public/builds/${build_id}/greenways.pmtiles`);
const chunks=Array.from({length:Math.ceil(archive.length/65536)},(_,id)=>archive.subarray(id*65536,(id+1)*65536));
const index={size:archive.length,chunkSize:65536,hashes:chunks.map(c=>createHash('sha256').update(c).digest('hex'))};
function fixture(){
 const calls:number[]=[];
 const request:typeof fetch=async input=>{
  const id=Number(String(input).split('/').pop()!.replace('.bin',''));calls.push(id);
  // Reproduce production hosting: ordinary 200 responses with no range headers.
  return new Response(new Uint8Array(chunks[id]),{status:200});
 };
 return {source:new StaticTileSource('https://example.test/tiles',index,request),calls};
}
test('static byte source crosses chunk boundaries, shares reads and clips the final range',async()=>{
 const {source,calls}=fixture();
 const [a,b]=await Promise.all([source.getBytes(65000,2000),source.getBytes(65000,2000)]);
 assert.deepEqual(Buffer.from(a.data),archive.subarray(65000,67000));
 assert.deepEqual(Buffer.from(a.data),Buffer.from(b.data));assert.deepEqual(calls,[0,1]);
 const tail=await source.getBytes(archive.length-20,100);
 assert.deepEqual(Buffer.from(tail.data),archive.subarray(-20));
});
test('real PMTiles city archive decodes and supplies George Street at zoom 15 without HTTP ranges',async()=>{
 const {source}=fixture();const pm=new PMTiles(source);
 assert.equal((await pm.getHeader()).maxZoom,16);
 const x=Math.floor((-87.706244+180)/360*2**15);
 const lat=41.933857*Math.PI/180;
 const y=Math.floor((1-Math.asinh(Math.tan(lat))/Math.PI)/2*2**15);
 const tile=await pm.getZxy(15,x,y);assert.ok(tile&&tile.data.byteLength>0);
});
test('corrupt chunks fail visibly instead of rendering invalid geometry',async()=>{
 const bad:typeof fetch=async()=>new Response(new Uint8Array(65536));
 const source=new StaticTileSource('https://example.test/tiles',index,bad);
 await assert.rejects(source.getBytes(0,127),/checksum mismatch/);
});
