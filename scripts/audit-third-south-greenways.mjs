// Independent checks against the original city rows and staged OSM extract.
// These test snapshot correspondence, not present-day signs or legal access.
import { locate, metres } from './route-network.mjs';

export function auditThirdSouthGreenways({data, db, cityRecords, evidenceRecords, check, sourceUrl}) {
  const expected={Charles:['row-sfkb.g97d.sgdr','row-xf8g~8ygn.jeka'],'98th':['row-qwjx_r592.h4qr','row-hhh6-5sg3~9x3s'],'82nd':['row-ihqd.w7jk-reas']};
  const byId=id=>cityRecords.find(r=>r[':id']===id);
  const route=id=>data.routes.find(r=>r.id===id);
  const way=id=>{const r=db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id);return r && {nodes:JSON.parse(r.nodes),tags:JSON.parse(r.tags)};};
  const node=id=>db.prepare('SELECT lon,lat,tags FROM nodes WHERE id=?').get(id);
  const coord=id=>{const n=node(id);return n && [n.lon,n.lat];};
  const url=id=>`https://www.openstreetmap.org/way/${id}`;
  const equals=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const distance=(p,id)=>Math.min(...byId(id).the_geom.coordinates.map(line=>locate(p,line).distance));
  const within=(coords,id,limit)=>coords.every((p,i)=>{if(!p || distance(p,id)>limit)return false;if(!i)return true;const a=coords[i-1],n=Math.max(1,Math.ceil(metres(a,p)));return Array.from({length:n},(_,j)=>{const t=(j+1)/n;return distance([a[0]+t*(p[0]-a[0]),a[1]+t*(p[1]-a[1])],id)<=limit;}).every(Boolean);});
  for(const [name,ids] of Object.entries(expected)) {
    const routes=data.routes.filter(r=>r.name===name),found=routes.flatMap(r=>r.source_ids);
    const ok=found.length===ids.length && ids.every(id=>byId(id)?.displayrou==='Neighborhood Greenway' && found.filter(x=>x===id).length===1) && found.every(id=>ids.includes(id));
    check(`third-south-${name.toLowerCase()}-scope`,true,ok,'Exactly the enumerated city Neighborhood Greenway rows appear once.',[sourceUrl]);
  }
  for(const [name,ids] of Object.entries(expected)) {
    const rs=data.routes.filter(r=>r.name===name);
    check(`third-south-${name.toLowerCase()}-components`,true,rs.length===ids.length && ids.every(id=>rs.some(r=>equals(r.source_ids,[id]))),'Geographically distinct source components remain separate.',[sourceUrl]);
  }
  // Source nodes retain topology identity; emitted geometry is checked separately.
  for(const [rid,cid,ends] of [['charles-1',expected.Charles[0],[261186290,261186289]],['charles-2',expected.Charles[1],[261186282,261186281]],['98th-1',expected['98th'][0],[261148935,539132499]],['98th-2',expected['98th'][1],[261215214,261215216]],['82nd-1',expected['82nd'][0],[6316989390,261240297]]]) {
    const r=route(rid),cityLine=byId(cid)?.the_geom.coordinates[0],road=r?.edges.filter(e=>e.way_id!=null)??[];
    const allBounded=road.length>0 && road.every(e=>within(e.geometry.coordinates,cid,12));
    const endsNear=cityLine && ends.every((id,i)=>{const p=coord(id);return p && Math.min(metres(p,cityLine[0]),metres(p,cityLine.at(-1)))<=12;});
    check(`third-south-${rid}-bounded`,true,!!(r && equals(r.source_ids,[cid]) && allBounded && endsNear),'All exported road geometry stays within 12 m of its own city line; expected endpoint nodes are within 12 m of the corresponding city endpoint. Topology node IDs do not define the clipped geometry endpoints.',[sourceUrl]);
  }
  for (const [rid,wid,terminal,sourceNode,cityEnd] of [['charles-1',146306483,'end',261186289,1],['charles-2',1230416810,'end',261186281,1]]) {
    const r=route(rid),edge=terminal==='start'?r?.edges[0]:r?.edges.at(-1),p=terminal==='start'?edge?.geometry.coordinates[0]:edge?.geometry.coordinates.at(-1),source=way(wid),sourceCoords=source?.nodes.map(coord),cityLine=byId(r.source_ids[0]).the_geom.coordinates[0],target=cityEnd?cityLine.at(-1):cityLine[0];
    const clipped=edge?.way_id===wid && edge.to_node===sourceNode && p && sourceCoords?.every(Boolean) && locate(p,sourceCoords).distance<0.1 && metres(p,coord(sourceNode))>0.1 && metres(p,target)<5;
    check(`third-south-${rid}-terminal-clipped`,true,!!clipped,'The actual terminal geometry is clipped onto its source way near the city endpoint and differs from the source endpoint node retained for topology.',[sourceUrl,url(wid)]);
  }
  const w=way(1359658130), west=way(24077508),east=way(919663824),r=route('98th-1'), es=r?.edges.filter(e=>e.way_id===1359658130)??[], chain=[1498962104,261150726,1498962124];
  const joined=west?.nodes.includes(chain[0]) && east?.nodes.includes(chain.at(-1));
  const exportedCoords=es.flatMap((e,i)=>i?e.geometry.coordinates.slice(1):e.geometry.coordinates);
  const sourceCoords=chain.map(coord), sourceLength=sourceCoords.slice(1).reduce((n,p,i)=>n+metres(sourceCoords[i],p),0);
  const exported=es[0]?.from_node===chain[0] && es.at(-1)?.to_node===chain.at(-1) && equals(exportedCoords,sourceCoords) && Math.abs(es.reduce((n,e)=>n+e.length_m,0)-sourceLength)<0.001 && es.every(e=>e.matching?.method==='explicit-city-geometry-way-slice' && equals(e.matching.city_source_ids,[expected['98th'][0]]) && ['forward','reverse'].every(d=>e.access[d].status==='allowed' && e.access[d].evidence_status==='source-inferred'));
  const evidence=evidenceRecords.find(e=>e.id==='98th-loomis-vincennes');
  const bound=evidence?.source_record_ids?.includes(expected['98th'][0]) && evidence?.way_segments?.some(s=>s.way_id===1359658130 && equals(s.nodes,chain));
  const sourceOk=equals(w?.nodes,chain) && !w?.tags.oneway && !['access','vehicle','motor_vehicle','motorcar'].some(k=>w?.tags[k]) && joined && within(chain.map(coord),expected['98th'][0],5);
  check('third-south-98th-throop-scoped-slice',true,!!(sourceOk && exported && bound),'The exact ordered Throop slice attaches to both 98th road ways, stays within 5 m of its city row at no more than one-metre intervals, and preserves both inferred motor directions.',[sourceUrl,url(1359658130),url(24077508),url(919663824)]);
  const conflicts=route('98th-2')?.edges.filter(e=>e.way_id===582898994)??[],dir=route('98th-2')?.edges.filter(e=>e.way_id===1230684260)??[];
  const cw=way(1230684260),bw=way(582898994);
  check('third-south-98th-east-direction-conflict',true,byId(expected['98th'][1])?.oneway_dir==='E' && !bw?.tags.oneway && cw?.tags.oneway==='yes' && cw.tags['oneway:bicycle']==='no' && coord(cw.nodes.at(-1))[0]>coord(cw.nodes[0])[0] && conflicts.length>0 && conflicts.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='unknown' && e.access.reverse.evidence_status==='conflicting') && dir.length>0 && dir.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked'),'City eastbound assertion conflicts with missing OSM oneway on the western block; bicycle contraflow on the eastern block does not grant car access.',[sourceUrl,url(582898994),url(1230684260)]);
  const ew=way(196459411),e82=route('82nd-1')?.edges.filter(e=>e.way_id===196459411)??[];
  check('third-south-82nd-eastbound',true,byId(expected['82nd'][0])?.oneway_dir==='E' && ew?.tags.oneway==='yes' && coord(ew.nodes.at(-1))[0]>coord(ew.nodes[0])[0] && e82.length>0 && e82.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked'),'The city motor direction agrees with eastbound staged node order and oneway tag.',[sourceUrl,url(196459411)]);
}
