import {readFileSync} from 'node:fs';
import {Summary} from '../web/src/threshold.ts';
const b=readFileSync('data/fixtures/output/summary.bin');
const summary=new Summary(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
const timings=[];for(let i=0;i<1000;i++)summary.at(i+1);
for(let i=0;i<10000;i++){const start=performance.now();summary.at(1+i*401);timings.push(performance.now()-start);}
timings.sort((a,b)=>a-b);console.log(JSON.stringify({updates:timings.length,p95_ms:timings[9500],max_ms:timings.at(-1),runtime:process.version}));
