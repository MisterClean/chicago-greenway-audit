// Independent snapshot checks; these do not establish current signs or actual lane designation.
import {locate, metres} from './route-network.mjs';

export function auditThirdNorthGreenways({data, db, cityRecords, evidenceRecords, check, sourceUrl}) {
  const expected = {
    Albion:['row-7hip-z8ja.9ka2','row-f4y4.9rez-hwpq','row-rwxu_bq5t-ipmv'],
    Birchwood:['row-bq4z~aa9m.899d','row-972k~6n95-qjxf'],
    'East Lake':['row-72jg_55uf~ckvs'], Jonquil:['row-d5jb_ba32_a78j']
  };
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const city=id=>cityRecords.find(x=>x[':id']===id);
  const route=name=>data.routes.find(x=>x.name===name);
  const way=id=>{const x=db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id); return x && {nodes:JSON.parse(x.nodes),tags:JSON.parse(x.tags)};};
  const node=id=>{const x=db.prepare('SELECT lon,lat,tags FROM nodes WHERE id=?').get(id);return x && {coord:[x.lon,x.lat],tags:JSON.parse(x.tags)};};
  const coords=ids=>ids.map(id=>node(id)?.coord);
  const url=id=>`https://www.openstreetmap.org/way/${id}`;
  const within=(points,id,limit)=>points.every((p,i)=>{if(!p)return false;if(!i)return locate(p,city(id).the_geom.coordinates[0]).distance<=limit;const a=points[i-1],n=Math.max(1,Math.ceil(metres(a,p)));return Array.from({length:n+1},(_,j)=>{const t=j/n,q=[a[0]+t*(p[0]-a[0]),a[1]+t*(p[1]-a[1])];return locate(q,city(id).the_geom.coordinates[0]).distance<=limit;}).every(Boolean);});
  for (const [name,ids] of Object.entries(expected)) {
    const found=data.routes.filter(x=>x.name===name).flatMap(x=>x.source_ids);
    check(`third-north-${name.toLowerCase().replaceAll(' ','-')}-scope`,true,found.length===ids.length && ids.every(id=>city(id)?.displayrou==='Neighborhood Greenway' && found.filter(x=>x===id).length===1) && found.every(id=>ids.includes(id)),'Exactly the enumerated city rows appear once.',[sourceUrl]);
  }
  const allIds=Object.values(expected).flat();
  check('third-north-evidence-status',true,allIds.every(id=>evidenceRecords.some(e=>e.source_record_ids?.includes(id) && e.review_status==='source-inferred')),'Every city row has source-inferred review evidence.',[sourceUrl]);
  const east=route('East Lake'), eastId=expected['East Lake'][0], north=way(24114915), south=way(34073688), ee=east?.edges.filter(e=>[24114915,34073688].includes(e.way_id))??[];
  const eastCity=city(eastId), northLine=north && coords(north.nodes), geometry=ee.flatMap(e=>e.geometry.coordinates), endpoint=geometry.length ? geometry.reduce((a,b)=>a[1]>b[1]?a:b) : null;
  const cityNorth=eastCity?.the_geom.coordinates[0].at(-1);
  const clip=endpoint && northLine?.every(Boolean) && cityNorth && Math.abs(locate(endpoint,northLine).position-locate(cityNorth,northLine).position)<1 && metres(endpoint,node(261325545).coord)>2;
  const nameOk=eastCity?.st_name==='EAST LAKE' && [north,south].every(w=>w?.tags.name==='North Eastlake Terrace' && w.tags.oneway==='yes' && w.tags['oneway:bicycle']==='no');
  const order=north?.nodes.at(-1)===south?.nodes[0] && node(north.nodes[0]).coord[1]>node(north.nodes.at(-1)).coord[1] && node(south.nodes[0]).coord[1]>node(south.nodes.at(-1)).coord[1];
  check('third-north-eastlake-alias-order-clip',true,!!(nameOk && order && clip && ee.some(e=>e.way_id===24114915) && ee.some(e=>e.way_id===34073688) && ee.every(e=>e.access.forward.status==='blocked' && e.access.reverse.status==='allowed')),'City EAST LAKE aliases OSM Eastlake; staged ways run south, while actual exported north geometry ends at the projected city boundary, not the source node.',[sourceUrl,url(24114915),url(34073688)]);
  const jw=way(210205666), je=route('Jonquil')?.edges.filter(e=>e.way_id===210205666)??[];
  check('third-north-jonquil-two-way',true,city(expected.Jonquil[0])?.oneway_dir==='-' && !!jw && !['oneway','access','vehicle','motor_vehicle','motorcar'].some(k=>jw.tags[k]) && je.length>0 && je.every(e=>['forward','reverse'].every(d=>e.access[d].status==='allowed' && e.access[d].evidence_status==='source-inferred')),'No city motor-direction assertion; mapped residential source supports inferred travel both ways.',[sourceUrl,url(210205666)]);
  const ring=way(1535604025), b=route('Birchwood'), re=b?.edges.find(e=>e.way_id===1535604025), rn=ring?.nodes.slice(0,-1);
  function arc(a,z) {if(!rn)return [];let i=rn.indexOf(a),out=[a];if(i<0||!rn.includes(z))return [];while(out.at(-1)!==z && out.length<=rn.length){i=(i+1)%rn.length;out.push(rn[i]);}return out;}
  const f=arc(13990513312,13990513311), rev=arc(13990513311,13990513312);
  const ringOk=ring?.tags.junction==='circular' && ring.tags.oneway==='yes' && ring.nodes[0]===ring.nodes.at(-1) && re?.from_node===13990513312 && re.to_node===13990513311 && eq(re.traversals?.forward?.geometry.coordinates,coords(f)) && eq(re.traversals?.reverse?.geometry.coordinates,coords(rev)) && ['forward','reverse'].every(d=>re.access[d].status==='allowed');
  const bw=[1535604024,104177858].map(way),be=b?.edges.filter(e=>[1535604024,104177858].includes(e.way_id))??[];
  check('third-north-birchwood-circle-and-direction',true,!!(ringOk && f.length>2 && rev.length>2 && bw.every(w=>w?.tags.oneway==='yes' && w.tags['oneway:bicycle']==='no') && be.length>0 && be.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked')),'The two circular traversals follow distinct ordered one-way source arcs; adjoining eastbound streets block reverse cars despite bicycle exceptions.',[sourceUrl,url(1535604025),url(1535604024),url(104177858)]);
  const ids=[458591863,1178008329],arms=ids.map(way), ar=route('Albion'), selected=ar?.edges.filter(e=>e.way_id===1178008329)??[];
  const interior=arms.flatMap(w=>w?.nodes.slice(1,-1)??[]), allNodes=[261212855,...interior,261294463], incident=[194803327,458591864,24089277,976197309,207297313,...ids];
  const relations=db.prepare("SELECT members,tags FROM relations").all().filter(r=>{const t=JSON.parse(r.tags);return t.type==='restriction' || Object.keys(t).some(k=>k.startsWith('restriction'));});
  const noRestrictions=relations.every(r=>JSON.parse(r.members).every(m=>!incident.includes(m.ref) && !allNodes.includes(m.ref)));
  const equalTags=arms.every(w=>w?.tags.highway==='residential' && w.tags.name==='West Albion Avenue' && w.tags.oneway==='yes' && w.tags['oneway:bicycle']==='yes' && w.tags.maxheight===`11'0\"` && !['access','vehicle','motor_vehicle','motorcar'].some(k=>w.tags[k]));
  const sameEndpoints=arms.every(w=>w?.nodes[0]===261212855 && w.nodes.at(-1)===261294463), disjoint=arms[0] && arms[1] && arms[0].nodes.slice(1,-1).every(n=>!arms[1].nodes.slice(1,-1).includes(n));
  const sourceNodes=allNodes.every(n=>eq(node(n)?.tags,{}));
  const highwayAt=n=>db.prepare('SELECT id,nodes,tags FROM ways WHERE nodes LIKE ?').all(`%${n}%`).filter(w=>JSON.parse(w.nodes).includes(n) && JSON.parse(w.tags).highway).map(w=>w.id).sort((a,b)=>a-b);
  const attachments=[[261212855,[24089277,194803327,458591863,1178008329]],[261294463,[458591863,458591864,976197309,1178008329]],[12233753877,[207297313,458591863]],[2174917836,[207297313,1178008329]],[12233753878,[458591863]],[12233753876,[1178008329]]].every(([n,ws])=>eq(highwayAt(n),ws.sort((a,b)=>a-b)));
  const approach=way(194803327),exit=way(458591864),alley=way(207297313);
  const junctions=approach?.nodes.at(-1)===261212855 && approach.tags.oneway==='yes' && exit?.nodes[0]===261294463 && exit.tags.oneway==='yes' && alley?.tags.highway==='service' && alley.tags.service==='alley' && !alley.tags.oneway && alley.nodes.includes(12233753877) && alley.nodes.includes(2174917836);
  const evidence=evidenceRecords.find(e=>e.id==='albion-glenwood-lakewood');
  check('third-north-albion-parallel-path',true,!!(sameEndpoints && disjoint && equalTags && sourceNodes && attachments && junctions && noRestrictions && arms.every(w=>within(coords(w.nodes),expected.Albion[0],8)) && selected.length>0 && selected[0].from_node===261212855 && selected.at(-1).to_node===261294463 && selected.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked') && !ar.edges.some(e=>e.way_id===207297313 || e.way_ids?.includes(207297313)) && evidence?.source_record_ids?.includes(expected.Albion[0])),'Both same-direction arms stay within 8 m at <=1 m sampling, have equal mapped through permission, shared endpoints and no matching restrictions. Selected arm is one mapped path; designation of either lane remains uncertain and alley is excluded.',[sourceUrl,...ids.map(url),url(207297313)]);
}
