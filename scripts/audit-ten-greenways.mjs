import { lineLength } from './route-network.mjs';
// Targeted checks compare the published movements with the independent city and OSM snapshots.
export function auditTenGreenways({data, db, cityRecords, evidenceRecords, check, sourceUrl}) {
  const families = {
    Keeler:['row-zjnt~tbtg~yxg8','row-8xia~c4cz~hqd9','row-6cw8-hzvx_wth2','row-ntbg~tksd.hb64','row-cnft-dzgn~79hm','row-9ita~rsfz.t6s7','row-qmjv_nhs8.tmi8','row-5gvx.my44_7s4z'],
    Lavergne:['row-jkmg_tcrm.hc9u','row-ptmd_mb28-aknh','row-qay7~qqhc_6mse','row-a6tq~5a4j~ykvi','row-2j8m_8py9_hx92','row-ii64-6e54-7i8z'],
    Long:['row-583t.mwuq.4nnw','row-h66p_pyv6-jxt2','row-d36z.5mk2-jea8','row-yxt5.zqyq_n3kt'],
    Menard:['row-ntha~efmu.qgse','row-nr6u_qxaq_g748'], Kilbourn:['row-z4qp-mbyn~7cpf','row-ukhy_di58-umh5'],
    Avers:['row-9ssb-pmdc~mnxf','row-hv69_div8~h47p'], 'Central Park':['row-88y6_ixms~chd9','row-shc4_jp57_jn6v'],
    Hirsch:['row-gdwe.mqgf.3i8u','row-4wbi~mp82_esuh'], 'Le Moyne':['row-c4a2_m526~522s','row-8p38.d5pr_483c','row-7dq3.m3hg-hks5'], Cullom:['row-dj6h~udgq~i6vi','row-pc7n_a4xw~gz6u']
  };
  const city = id => cityRecords.find(r=>r[':id']===id);
  const route = id => data.routes.find(r=>r.id===id);
  const way = id => { const w=db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id); return w ? {nodes:JSON.parse(w.nodes),tags:JSON.parse(w.tags)} : null; };
  const node = id => id == null ? null : db.prepare('SELECT lon,lat FROM nodes WHERE id=?').get(id);
  const url = id => `https://www.openstreetmap.org/way/${id}`;
  const bothUnknown = e => ['forward','reverse'].every(d=>e?.access?.[d]?.status==='unknown');
  const noCross = (r,i) => !!r && i>0 && i<r.edges.length-1 && r.runs.every(run=>!run.edge_ids.includes(r.edges[i].id) && !(run.edge_ids.includes(r.edges[i-1].id) && run.edge_ids.includes(r.edges[i+1].id)));
  for (const [name, ids] of Object.entries(families)) {
    const found=data.routes.filter(r=>r.name===name);
    check(`ten-${name.toLowerCase().replaceAll(' ','-')}-city-scope`,true,ids.every(id=>city(id)?.displayrou==='Neighborhood Greenway' && found.filter(r=>r.source_ids.includes(id)).length===1) && found.flatMap(r=>r.source_ids).length===ids.length && found.flatMap(r=>r.source_ids).every(id=>ids.includes(id)), 'Exact independently enumerated city records are represented once; no other city category is admitted.',[sourceUrl]);
  }
  const south=families.Keeler.slice(0,5), north=families.Keeler.slice(5);
  check('ten-keeler-separate-parts',true,!!route('keeler-1') && !!route('keeler-2') && south.every(id=>route('keeler-1').source_ids.includes(id)) && north.every(id=>route('keeler-2').source_ids.includes(id)) && !route('keeler-1').source_ids.some(id=>north.includes(id)) && !route('keeler-2').source_ids.some(id=>south.includes(id)),'The city rows stop on opposite sides of I-290; do not insert a designated bridge.',[sourceUrl]);
  check('ten-lavergne-separate-parts',true,!!route('lavergne-1') && !!route('lavergne-2') && route('lavergne-1').source_ids.length===1 && route('lavergne-1').source_ids[0]===families.Lavergne[0] && families.Lavergne.slice(1).every(id=>route('lavergne-2').source_ids.includes(id)) && !route('lavergne-2').source_ids.includes(families.Lavergne[0]),'The geographically separated city components must not be joined by an off-route Madison detour.',[sourceUrl]);
  const k=route('keeler-2'), ki=k?.edges.findIndex(e=>e.role==='gap' && e.length_m>20 && e.length_m<30) ?? -1;
  const incident=db.prepare("SELECT id FROM ways WHERE nodes LIKE '%737123061%'").all().filter(w=>way(w.id).nodes.includes(737123061)).map(w=>w.id);
  check('ten-keeler-washington-gap',true,ki>0 && bothUnknown(k.edges[ki]) && k.edges[ki-1].to_node===261143263 && k.edges[ki+1].from_node===737123061 && JSON.stringify(incident.sort((a,b)=>a-b))===JSON.stringify([59440909]) && noCross(k,ki),'Washington traffic signal and the turning circle have no shared motor-way node in the snapshot; retain the unknown gap.',[sourceUrl,url(24089297),url(59440909)]);
  const long=route('long-1');
  for (const [id,allowed,blocked] of [[1446329395,'forward','reverse'],[1434564096,'reverse','forward']]) {
    const w=way(id), es=long?.edges.filter(e=>e.way_id===id) ?? [], a=node(w?.nodes[0]), b=node(w?.nodes.at(-1));
    check(`ten-long-${id}-direction`,true,w?.tags.oneway==='yes' && !!a && !!b && (id===1446329395 ? b.lat>a.lat : b.lat<a.lat) && es.some(e=>e.access[allowed].status==='allowed' && e.access[blocked].status==='blocked') && es.every(e=>e.access[blocked].status!=='allowed'),'Opposing source way node orders and one-way tags govern motor travel; bicycle contraflow does not apply to cars.',[sourceUrl,url(id)]);
  }
  const boundary=long?.edges.find(e=>e.way_id===1446329395 && e.to_node===289550210);
  check('ten-long-boundary-unknown',true,!!boundary && bothUnknown(boundary) && long.runs.every(r=>!r.edge_ids.includes(boundary.id)),'The source-direction boundary remains unknown; no through run may use it.',[sourceUrl,url(1446329395),url(1434564096)]);
  for (const [rid,cityId,wid,axis,allow,block] of [['avers-1','row-9ssb-pmdc~mnxf',24094946,'N','forward','reverse'],['central-park-1','row-88y6_ixms~chd9',1314504012,'S','reverse','forward']]) {
    const w=way(wid), a=node(w?.nodes[0]), b=node(w?.nodes.at(-1)), es=route(rid)?.edges.filter(e=>e.way_id===wid) ?? [];
    check(`ten-${rid}-motor-direction`,true,city(cityId)?.oneway_dir===axis && w?.tags.oneway==='yes' && !!a && !!b && (axis==='N'?b.lat>a.lat:b.lat<a.lat) && es.length>0 && es.every(e=>e.access[allow].status==='allowed' && e.access[block].status==='blocked'),'City motor direction and source node order agree; bicycle exceptions are not car access.',[sourceUrl,url(wid)]);
  }
  const lm=route('le-moyne-1'), lw=way(583154158), les=lm?.edges.filter(e=>e.way_id===583154158) ?? [], la=node(lw?.nodes[0]), lb=node(lw?.nodes.at(-1));
  check('ten-le-moyne-westbound-blank-city',true,city('row-7dq3.m3hg-hks5')?.oneway_dir==='-' && lw?.tags.oneway==='yes' && !!la && !!lb && lb.lon<la.lon && les.length>0 && les.every(e=>e.access.forward.status==='blocked' && e.access.reverse.status==='allowed'),'A city dash makes no motor-direction assertion; the staged OSM westbound one-way remains controlling snapshot evidence.',[sourceUrl,url(583154158)]);
  const h=route('hirsch-1'), hi=h?.edges.findIndex(e=>e.role==='gap' && e.length_m>90 && e.length_m<115) ?? -1, cycle=way(1230671144);
  check('ten-hirsch-cycleway-unknown',true,cycle?.tags.highway==='cycleway' && hi>0 && bothUnknown(h.edges[hi]) && h.edges[hi-1].to_node===261309165 && cycle.nodes.includes(261309165) && noCross(h,hi),'The source cycleway is not a motor road; retain an unknown gap with no crossing run.',[sourceUrl,url(1230671144)]);
  const m=route('menard-1');
  for (const [label,min,max] of [['14m',12,16],['72m',69,75]]) {
    const i=m?.edges.findIndex(e=>e.role==='gap' && e.length_m>min && e.length_m<max) ?? -1;
    check(`ten-menard-${label}-unknown`,true,i>0 && bothUnknown(m.edges[i]) && noCross(m,i),'Unmatched city geometry remains unknown with no ordinary-car run spanning it.',[sourceUrl]);
  }
  // Project to local metres, then measure every source arc segment against the original city line.
  const xy = p=>[p[0]*83000,p[1]*111000];
  function pointSegment(p,a,b) { const [x,y]=xy(p),[ax,ay]=xy(a),[bx,by]=xy(b),dx=bx-ax,dy=by-ay; const t=dx||dy?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))):0; return Math.hypot(x-ax-t*dx,y-ay-t*dy); }
  function distanceToCity(p,ids) { return Math.min(...ids.flatMap(id=>city(id).the_geom.coordinates.flatMap(line=>line.slice(1).map((b,i)=>pointSegment(p,line[i],b))))); }
  function orderedArc(nodes,start,end) { const ring=nodes.slice(0,-1), i=ring.indexOf(start), j=ring.indexOf(end); if(i<0||j<0)return []; const result=[start]; for(let k=(i+1)%ring.length;k!==j;k=(k+1)%ring.length) {result.push(ring[k]); if(result.length>ring.length)return [];} result.push(end); return result; }
  for (const [rid,wid,ids] of [['kilbourn-1',1541446219,families.Kilbourn],['cullom-1',1535692175,families.Cullom]]) {
    const r=route(rid), w=way(wid), i=r?.edges.findIndex(e=>e.way_id===wid && e.role==='junction') ?? -1, e=r?.edges[i];
    const valid=!!w && w.tags.oneway==='yes' && w.nodes[0]===w.nodes.at(-1) && !!e && i>0 && i<r.edges.length-1 && r.edges[i-1].to_node===e.from_node && r.edges[i+1].from_node===e.to_node && ['forward','reverse'].every(d=>{
      const ns=orderedArc(w.nodes,d==='forward'?e.from_node:e.to_node,d==='forward'?e.to_node:e.from_node);
      const coords=ns.map(n=>node(n)).map(n=>n&&[n.lon,n.lat]);
      const traversal=e.traversals?.[d];
      return ns.length>1 && coords.every(Boolean) && JSON.stringify(coords)===JSON.stringify(traversal?.geometry?.coordinates) && traversal.access.status==='allowed' && traversal.source_way_ids.includes(wid) && coords.every((p,j)=>{ if(distanceToCity(p,ids)>18)return false; if(j===0)return true; const a=coords[j-1], step=Math.ceil(Math.hypot(...xy(p).map((v,k)=>v-xy(a)[k]))); return Array.from({length:step},(_,k)=>(k+1)/step).every(t=>distanceToCity([a[0]+t*(p[0]-a[0]),a[1]+t*(p[1]-a[1])],ids)<=18); });
    });
    check(`ten-${rid}-circle-arcs`,true,valid,'Both distinct traversals follow increasing source-node order around the closed one-way circle, attach at both adjoining road nodes and remain within 18 m of the original city line.',[sourceUrl,url(wid)]);
  }
  for (const [rid,forwardId,reverseId,cityId,evidenceId] of [
    ['lavergne-2',1213420157,1213420158,'row-qay7~qqhc_6mse','lavergne-kinzie-parallel-arms'],
    ['menard-1',582888785,582888784,'row-nr6u_qxaq_g748','menard-lake-parallel-arms'],
  ]) {
    const r=route(rid), index=r?.edges.findIndex(e=>e.matching?.evidence_id===evidenceId) ?? -1, e=r?.edges[index];
    const ev=evidenceRecords.find(record=>record.id===evidenceId), pair=[way(forwardId),way(reverseId)];
    const bounded=pair.every(w=>w && w.tags.oneway==='yes' && w.tags.name===pair[0].tags.name) && pair[0].nodes[0]===pair[1].nodes.at(-1) && pair[0].nodes.at(-1)===pair[1].nodes[0];
    const valid=bounded && index>0 && index<r.edges.length-1 && r.edges[index-1].to_node===e.from_node && r.edges[index+1].from_node===e.to_node && ev?.source_record_ids.includes(cityId) && [forwardId,reverseId].every(id=>ev.way_ids.includes(id)) && ['forward','reverse'].every((direction,i)=>{
      const coordinates=pair[i].nodes.map(id=>node(id)).map(n=>[n.lon,n.lat]), traversal=e.traversals?.[direction];
      return JSON.stringify(coordinates)===JSON.stringify(traversal?.geometry.coordinates) && traversal.source_way_ids.length===1 && traversal.source_way_ids[0]===[forwardId,reverseId][i] && Math.abs(traversal.length_m-lineLength(coordinates))<0.001 && coordinates.every((p,j)=>{
        if(distanceToCity(p,[cityId])>8)return false; if(!j)return true; const a=coordinates[j-1],steps=Math.ceil(lineLength([a,p]));
        return Array.from({length:steps},(_,k)=>(k+1)/steps).every(t=>distanceToCity([a[0]+t*(p[0]-a[0]),a[1]+t*(p[1]-a[1])],[cityId])<=8);
      });
    });
    check(`ten-${rid}-bounded-split-arms`,true,!!valid,'The two bound carriageways retain opposite source node order, original motor tags, distinct geometry and independently measured distances within eight metres of their exact city row.',[sourceUrl,url(forwardId),url(reverseId)]);
    check(`ten-${rid}-split-city-conflict`,true,!!e && e.access.forward.status==='allowed' && e.access.reverse.status==='unknown' && e.access.reverse.evidence_status==='conflicting' && e.traversals.reverse.access.status==='unknown' && (rid==='menard-1' ? city(cityId)?.oneway_dir==='N' : city(cityId)?.oneway_dir==='-' && city('row-a6tq~5a4j~ykvi')?.oneway_dir==='N') && r.runs.every(run=>run.direction!=='reverse' || !run.edge_ids.includes(e.id)),'The correct southbound carriageway exists in OSM, but the CDOT direction assertion or its boundary still conflicts; no southbound car run crosses this unresolved segment.',[sourceUrl,url(reverseId)]);
  }
}
