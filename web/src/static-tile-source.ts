import type { Source, RangeResponse } from 'pmtiles';

export type ChunkIndex = { size:number; chunkSize:number; hashes:string[] };

/** Serve archive byte ranges through small static files when hosting ignores Range.
 * At most four verified chunks are retained; concurrent readers share requests.
 */
export class StaticTileSource implements Source {
 private readonly cache=new Map<number,Uint8Array>();
 private readonly pending=new Map<number,Promise<Uint8Array>>();
 constructor(private readonly url:string,private readonly index:ChunkIndex,private readonly request:typeof fetch=(...args)=>fetch(...args)){
  if(!Number.isSafeInteger(index.size)||index.size<=0||index.chunkSize!==65536||index.hashes.length!==Math.ceil(index.size/index.chunkSize)||!index.hashes.every(h=>/^[a-f0-9]{64}$/.test(h)))throw new Error('Invalid tile chunk index');
 }
 getKey(){return this.url;}
 private async chunk(id:number):Promise<Uint8Array>{
  const cached=this.cache.get(id);
  if(cached){this.cache.delete(id);this.cache.set(id,cached);return cached;}
  const pending=this.pending.get(id);if(pending)return pending;
  const task=(async()=>{
   const response=await this.request(`${this.url}/${id}.bin`);
   if(!response.ok)throw new Error(`Could not load greenway tile chunk (${response.status})`);
   const data=await response.arrayBuffer();
   if(data.byteLength!==Math.min(this.index.chunkSize,this.index.size-id*this.index.chunkSize))throw new Error('Incomplete greenway tile chunk');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==this.index.hashes[id])throw new Error('Greenway tile checksum mismatch');
   const bytes=new Uint8Array(data);this.cache.set(id,bytes);
   if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value!);
   return bytes;
  })();
  this.pending.set(id,task);
  try{return await task;}finally{this.pending.delete(id);}
 }
 async getBytes(offset:number,length:number,signal?:AbortSignal):Promise<RangeResponse>{
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset>=this.index.size)throw new Error('Invalid tile byte range');
  signal?.throwIfAborted();
  const end=Math.min(offset+length,this.index.size),data=new Uint8Array(end-offset);
  for(let position=offset;position<end;){
   const id=Math.floor(position/this.index.chunkSize),chunk=await this.chunk(id);
   signal?.throwIfAborted();
   const start=position-id*this.index.chunkSize,count=Math.min(chunk.length-start,end-position);
   data.set(chunk.subarray(start,start+count),position-offset);position+=count;
  }
  return {data:data.buffer};
 }
}
