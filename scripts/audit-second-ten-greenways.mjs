// Independent source-based assertions for the second ten-family expansion.
export function auditSecondTenGreenways({data,db,cityRecords,evidenceRecords,check,sourceUrl}) {
  const families={
    Ravenswood:['row-kk9s.wxvh.54pi','row-ih3q-vktm_ivy8','row-pt3s-nbhw-9kfh','row-7dga-i4ae-zmgx','row-m4n8-p2fm-is63','row-q9v3~jvue.ejt3'],
    Greenview:['row-2d5z_n6jd.a66w'], Wellington:['row-befx.natn-zwgj','row-mwnn~eyc4~ei26','row-rcf6-tuy9~chwa'],
    Ridgeway:['row-r4yb-73vz_r9hg','row-p79a-nzw3.kric','row-hpxf_p7zn-jsiw','row-7uzh.p3e8.fn7z'],
    Erie:['row-2y8f-r3mi~ijsb','row-qyu3.mg3k_g39b','row-szw6-2x9a-2ss9'], '14th':['row-3hq2~mvyq~hukh'], '21st':['row-5sa4_xspd-vvaq'],
    '81st':['row-53mk.drxs-c7u5','row-qamp~8ey4_t5q5','row-f7h5-aybk~kywp','row-u3h7_6cmi_gaje','row-p9y5~a44c.4cdy'],
    Prospect:['row-itvd~cpd9_7nut','row-57jp.grb6_4xzj'], Ewing:['row-4hwn_z284-aimv']};
  const city=id=>cityRecords.find(r=>r[':id']===id), route=id=>data.routes.find(r=>r.id===id);
  const way=id=>{const r=db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id);return r?{nodes:JSON.parse(r.nodes),tags:JSON.parse(r.tags)}:null;};
  const node=id=>id==null?null:db.prepare('SELECT lon,lat FROM nodes WHERE id=?').get(id);
  const url=id=>`https://www.openstreetmap.org/way/${id}`;
  const sourceIds=Object.values(families).flat();
  for(const [name,ids] of Object.entries(families)) {
    const rs=data.routes.filter(r=>r.name===name), found=rs.flatMap(r=>r.source_ids);
    check(`second-ten-${name.toLowerCase()}-scope`,true,ids.every(id=>city(id)?.displayrou==='Neighborhood Greenway' && found.filter(i=>i===id).length===1) && found.length===ids.length && found.every(id=>ids.includes(id)), 'Exactly the independently enumerated city greenway rows are represented, once each.',[sourceUrl]);
  }
  check('second-ten-snapshot-and-review-status',true,sourceIds.length===27 && data.source?.osm_date==='2026-09-11' && data.source?.designation_date==='2025-12' && data.source?.osm_sha256==='f24bf47c661b461bc817e4be127bb1726c82c014054df1f9bc39b1fe8b1c3f8c' && data.routes.filter(r=>families[r.name]).every(r=>r.edges.every(e=>['source-inferred','conflicting'].includes(e.access.forward.evidence_status) && ['source-inferred','conflicting'].includes(e.access.reverse.evidence_status))), 'Saved source dates and hash identify the snapshot; no new edge is field approved.',[sourceUrl]);
  function separated(name,groups){const rs=data.routes.filter(r=>r.name===name);return rs.length===groups.length && groups.every(ids=>rs.some(r=>r.source_ids.length===ids.length && ids.every(id=>r.source_ids.includes(id))));}
  check('second-ten-ravenswood-separated',true,separated('Ravenswood',[[families.Ravenswood[0]],families.Ravenswood.slice(1)]),'Distinct city components are not joined by an off-route bridge.',[sourceUrl]);
  check('second-ten-ridgeway-separated',true,separated('Ridgeway',[families.Ridgeway.slice(0,2),[families.Ridgeway[2]],[families.Ridgeway[3]]]),'The separated Ridgeway components are kept distinct.',[sourceUrl]);
  check('second-ten-81st-separated',true,separated('81st',[[families['81st'][0]],families['81st'].slice(1)]),'No designated city row connects Racine and Halsted.',[sourceUrl]);
  function direction(id,cityId,wid,axis,allow,block){const w=way(wid),a=node(w?.nodes[0]),b=node(w?.nodes.at(-1)),es=route(id)?.edges.filter(e=>e.way_id===wid)??[];return city(cityId)?.oneway_dir===axis && w?.tags.oneway==='yes' && !!a && !!b && (axis==='W'?b.lon<a.lon:b.lat<a.lat) && es.length>0 && es.every(e=>e.access[allow].status==='allowed' && e.access[block].status==='blocked');}
  for(const [id,cid,wid,axis] of [['ewing-1',families.Ewing[0],57184478,'S'],['14th-1',families['14th'][0],24076360,'W'],['81st-1',families['81st'][0],1123896995,'W'],['wellington-1',families.Wellington[0],216246563,'W']])
    check(`second-ten-${id}-direction`,true,direction(id,cid,wid,axis,'reverse','forward'),'City motor direction agrees with staged way order and motor one-way tag; bicycle exceptions do not permit cars.',[sourceUrl,url(wid)]);
  for(const [id,cid,wid] of [['erie-1',families.Erie[0],406711242],['21st-1',families['21st'][0],145834811],['prospect-1',families.Prospect[0],1230717385]]){
    const w=way(wid),es=route(id)?.edges.filter(e=>e.way_id===wid)??[];
    check(`second-ten-${id}-blank-city`,true,city(cid)?.oneway_dir==='-' && !!w && !w.tags.oneway && es.length>0 && es.every(e=>['forward','reverse'].every(d=>e.access[d].status==='allowed' && e.access[d].evidence_status==='source-inferred')), 'A blank city direction makes no two-way assertion; the missing OSM one-way tag supports only a snapshot inference.',[sourceUrl,url(wid)]);
  }
  const rg=route('ridgeway-2'), gap=rg?.edges.find(e=>e.role==='gap' && e.length_m>24 && e.length_m<29);
  check('second-ten-ridgeway-bloomingdale-gap',true,!!gap && ['forward','reverse'].every(d=>gap.access[d].status==='unknown') && rg.runs.every(r=>!r.edge_ids.includes(gap.id)) && way(1418787325)?.tags.highway==='cycleway' && rg.edges.some(e=>e.from_node===261118560),'The Bloomingdale terminal is an unknown motor connection; a nearby cycleway does not establish car access.',[sourceUrl,url(1418787325),url(24071229)]);
  const xy=p=>[p[0]*83000,p[1]*111000];
  function pointSegment(p,a,b){const [x,y]=xy(p),[ax,ay]=xy(a),[bx,by]=xy(b),dx=bx-ax,dy=by-ay;const t=dx||dy?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))):0;return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
  function cityDistance(p,cid){const lines=city(cid)?.the_geom?.coordinates??[];return Math.min(...lines.flatMap(line=>line.slice(1).map((b,i)=>pointSegment(p,line[i],b))));}
  function bounded(coords,cid,limit){return coords.every((p,i)=>{if(cityDistance(p,cid)>limit)return false;if(!i)return true;const a=coords[i-1],aa=xy(a),bb=xy(p),count=Math.max(1,Math.ceil(Math.hypot(bb[0]-aa[0],bb[1]-aa[1])));return Array.from({length:count},(_,j)=>(j+1)/count).every(t=>cityDistance([a[0]+t*(p[0]-a[0]),a[1]+t*(p[1]-a[1])],cid)<=limit);});}
  function length(coords){const R=6371008.8,rad=Math.PI/180;return coords.slice(1).reduce((sum,p,i)=>{const q=coords[i],dlat=(p[1]-q[1])*rad,dlon=(p[0]-q[0])*rad,a=Math.sin(dlat/2)**2+Math.cos(q[1]*rad)*Math.cos(p[1]*rad)*Math.sin(dlon/2)**2;return sum+2*R*Math.asin(Math.sqrt(a));},0);}
  function sourceChain(ids){let nodes=[];for(const id of ids){const w=way(id);if(!w || w.tags.oneway!=='yes' || (nodes.length && nodes.at(-1)!==w.nodes[0]))return null;nodes.push(...(nodes.length?w.nodes.slice(1):w.nodes));}return nodes;}
  function coords(ns){return ns.map(id=>node(id)).map(n=>n&&[n.lon,n.lat]);}
  const splitSpecs=[
    {route:'81st-2',evidence:'81st-union-west-opposing-arms',city:'row-u3h7_6cmi_gaje',forward:[1323964791,1323964792,1323964793],reverse:[1323964795,57782135,1323964796],forwardNodes:[12251419592,12251419589,12251419590,12251419591],reverseNodes:[12251419591,716925210,716925126,12251419592],cap:180},
    {route:'81st-2',evidence:'81st-union-east-opposing-arms',city:'row-u3h7_6cmi_gaje',forward:[1323964788,1323964787,1323964786,1323964789,1323964790],reverse:[1323964797,57700822,57700825,57700824,57700823],forwardNodes:[261137887,12251419586,12251419585,12251419587,12251419588,261137881],reverseNodes:[261137881,715432098,715432101,715432145,715432104,261137887],cap:250},
    {route:'greenview-1',evidence:'greenview-ridge-opposing-arms',city:'row-2d5z_n6jd.a66w',forward:[1322012667],reverse:[1322012663],forwardNodes:[12233741042,1752618578,12398855059,12233741035,261166391,12398855072,1752618577,735250172],reverseNodes:[735250172,12233741037,12233741038,12398855071,12233741036,12233741032,12398855058,12233741042],cap:180}
  ];
  for(const s of splitSpecs){
    const r=route(s.route), all=[...s.forward,...s.reverse], e=r?.edges.find(e=>e.matching?.evidence_id===s.evidence), ev=evidenceRecords.find(x=>x.id===s.evidence), a=sourceChain(s.forward),b=sourceChain(s.reverse), ac=a&&coords(a),bc=b&&coords(b);
    const i=e?r.edges.indexOf(e):-1;
    const sourceOk=JSON.stringify(a)===JSON.stringify(s.forwardNodes) && JSON.stringify(b)===JSON.stringify(s.reverseNodes) && a?.[0]===b?.at(-1) && a?.at(-1)===b?.[0] && ac?.every(Boolean) && bc?.every(Boolean) && bounded(ac,s.city,8) && bounded(bc,s.city,8) && length(ac)+length(bc)<=s.cap;
    const exported=!!e && i>0 && i<r.edges.length-1 && e.from_node===a?.[0] && e.to_node===a?.at(-1) && r.edges[i-1].to_node===e.from_node && r.edges[i+1].from_node===e.to_node && JSON.stringify([...e.way_ids].sort((x,y)=>x-y))===JSON.stringify([...all].sort((x,y)=>x-y)) && ['forward','reverse'].every((d,j)=>{const t=e.traversals?.[d], ids=j?s.reverse:s.forward, coordinates=j?bc:ac;return JSON.stringify(t?.source_way_ids)===JSON.stringify(ids) && JSON.stringify(t?.geometry?.coordinates)===JSON.stringify(coordinates) && Math.abs(t.length_m-length(coordinates))<1 && t.access.status==='allowed' && t.access.evidence_status==='source-inferred';});
    check(`second-ten-${s.evidence}`,true,!!sourceOk && !!exported && ev?.source_record_ids?.includes(s.city) && all.every(id=>ev?.way_ids?.includes(id)), 'Opposed source-ordered one-way chains share both endpoints, attach to the named route, remain within 8 m of the original city line at one-metre samples and preserve geodesic lengths and both motor traversals.',[sourceUrl,...all.map(url)]);
  }
  const branchExpected={261166391:[1322012665],1752618577:[59294756,1465196439],12233741032:[1322012664],12233741035:[1322012664],12233741036:[1322012665],12233741037:[1019257933,1465196439]};
  const branchOk=Object.entries(branchExpected).every(([id,expected])=>{const actual=db.prepare('SELECT id,nodes,tags FROM ways WHERE nodes LIKE ?').all(`%${id}%`).filter(w=>JSON.parse(w.nodes).includes(Number(id)) && JSON.parse(w.tags).highway && ![1322012663,1322012667].includes(w.id)).map(w=>w.id).sort((a,b)=>a-b);return JSON.stringify(actual)===JSON.stringify(expected.sort((a,b)=>a-b));});
  const gr=route('greenview-1'), ge=gr?.edges.find(e=>e.matching?.evidence_id==='greenview-ridge-opposing-arms');
  const excludedBranches=new Set(Object.values(branchExpected).flat());
  const noBranchEdges=!!gr && gr.edges.every(e=>{const ids=[e.way_id,...(e.way_ids??[]),...Object.values(e.traversals??{}).flatMap(t=>t.source_way_ids??[])];return ids.every(id=>!excludedBranches.has(id));});
  check('second-ten-greenview-branches-not-bypassed',true,branchOk && !!ge && ge.way_ids.every(id=>[1322012663,1322012667].includes(id)) && noBranchEdges, 'All six interior-node motor branch inventories are checked independently; none of those branch ways appears anywhere in the exported route or its traversal sources.',[sourceUrl,...[1322012663,1322012667,...excludedBranches].map(url)]);
  function orderedArc(ns,start,end){if(!ns || ns[0]!==ns.at(-1))return [];const ring=ns.slice(0,-1),i=ring.indexOf(start),j=ring.indexOf(end);if(i<0||j<0)return [];const result=[start];for(let k=(i+1)%ring.length;k!==j;k=(k+1)%ring.length){result.push(ring[k]);if(result.length>ring.length)return [];}result.push(end);return result;}
  for(const [wid,start,end] of [[1535604732,13990510749,13990510737],[1535604735,13990510772,13990510760],[1410844440,12963928584,12963928583],[1535604025,13990513309,13990513310]]){
    const r=route('greenview-1'),w=way(wid),i=r?.edges.findIndex(e=>e.way_id===wid && e.role==='junction')??-1,e=r?.edges[i];
    const arcs=[[start,end],[end,start]].map(([a,b])=>coords(orderedArc(w?.nodes,a,b)));
    const valid=w?.tags.oneway==='yes' && e?.from_node===start && e?.to_node===end && i>0 && i<r.edges.length-1 && r.edges[i-1].to_node===start && r.edges[i+1].from_node===end && ['forward','reverse'].every((d,j)=>{const t=e.traversals?.[d],c=arcs[j];return c.length>1 && c.every(Boolean) && bounded(c,'row-2d5z_n6jd.a66w',18) && JSON.stringify(t?.geometry?.coordinates)===JSON.stringify(c) && t.source_way_ids.includes(wid) && t.access.status==='allowed' && Math.abs(t.length_m-length(c))<1;});
    check(`second-ten-greenview-circle-${wid}`,true,!!valid,'Both circle arcs follow exact staged one-way node order, attach at independently identified endpoints and remain within the 18 m city-line tolerance.',[sourceUrl,url(wid)]);
  }
}
