import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const ndjson=async path=>(await readFile(path,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
/** Reviewed, normalized pilot inputs. The raw OSM candidate report is never an approval. */
export async function reviewedBundle(directory,sourceChecksum){
 const root=resolve(directory);const review=await json(`${root}/review.json`);
 if(!review.reviewer||!/^\d{4}-\d{2}-\d{2}$/.test(review.evidence_date)||!review.reason||review.source_snapshot_sha256!==sourceChecksum)throw new Error('Reviewed bundle requires a dated reviewer, reason, and matching designation snapshot checksum.');
 const inventory=await json(`${root}/inventory.json`);
 const segments=await ndjson(`${root}/segments.ndjson`);
 const states=await ndjson(`${root}/states.ndjson`);
 const stateDetails=await json(`${root}/state-details.json`);
 const seen=new Set();for(const row of inventory){if(seen.has(row.sid)||!Number.isSafeInteger(row.gw_mm)||row.gw_mm<=0||row.coordinates.length<2||!row.sources.length)throw new Error('Invalid unique inventory');seen.add(row.sid);}
 if(inventory.length!==segments.length)throw new Error('Every designation interval needs a segment record');
 const segmentIds=new Set();for(const s of segments){const row=inventory.find(r=>r.sid===s.sid);if(!row||row.gw_mm!==s.gw_mm||segmentIds.has(s.sid))throw new Error('Segment inventory mismatch');segmentIds.add(s.sid);}
 for(const s of states){const detail=stateDetails[s.id];if(!detail?.direction||!detail.upstream_reason||!detail.downstream_reason||!detail.geometry||!detail.evidence?.length)throw new Error(`Missing state evidence: ${s.id}`);if(!Number.isSafeInteger(s.length_mm)||s.length_mm<0)throw new Error('Unsafe state length');}
 return{inventory,segments,states,stateDetails,review};
}
/** Witnesses follow deterministic predecessor pointers, then the accepted successor chain. */
export function witnessFor(state,witnesses,stateDetails){
 let start=state;const guard=new Set();
 while(witnesses.get(start)?.predecessor!=null){if(guard.has(start))throw new Error('Cyclic witness');guard.add(start);start=witnesses.get(start).predecessor;}
 const ids=[];let e=start;guard.clear();
 while(e!=null){if(guard.has(e))throw new Error('Cyclic witness');guard.add(e);ids.push(e);e=witnesses.get(e)?.next??null;}
 return{id:start,first:stateDetails[start],last:stateDetails[ids.at(-1)],geometry:{type:'FeatureCollection',features:ids.map(id=>({type:'Feature',properties:{state:id},geometry:stateDetails[id].geometry}))}};
}
