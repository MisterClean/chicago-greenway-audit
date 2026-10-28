// Independent checks against the historical city extract and staged OSM snapshot.
import { locate, metres } from './route-network.mjs';

export function auditRemainingSouth({data, db, cityRecords, evidenceRecords, check, sourceUrl}) {
  const expected = {
    plymouth:'row-2j6z-x5nh-hr4p', ninth:'row-qvtr_8ne7~bvpp',
    avenueJ:'row-3ta3-sx9b.3hwx', hundredth:'row-vp89-azea-6dxh',
    nineteenth:'row-c5x4_w9sf~sv5y', douglas:'row-ud98-pggg_z4tm',
    hundredFifth:'row-9qrz~v2qv.wvsa', hundredFourth:'row-363v~eatx.v9ft',
    ninetySeventh:'row-xzr7_qctm-mt7e', montgomery:'row-uffi~2sbc~izvz',
  };
  const city = id => cityRecords.find(r => r[':id'] === id);
  const routes = id => data.routes.filter(r => r.source_ids.includes(id));
  const edges = id => routes(id).flatMap(r => r.edges);
  const way = id => { const r = db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id); return r && {nodes:JSON.parse(r.nodes),tags:JSON.parse(r.tags)}; };
  const node = id => { const r=db.prepare('SELECT lon,lat,tags FROM nodes WHERE id=?').get(id); return r && {coord:[r.lon,r.lat],tags:JSON.parse(r.tags)}; };
  const osm = id => `https://www.openstreetmap.org/way/${id}`;
  const evidence = id => evidenceRecords.some(e => e.source_record_ids?.includes(id) && e.review_status === 'source-inferred' && typeof e.review_needed === 'string' && e.review_needed.trim());
  const gap = id => edges(id).some(e => e.role === 'gap' && ['forward','reverse'].every(d => e.access?.[d]?.status === 'unknown')) && evidence(id);
  const touches = (e,wid) => e.way_id===wid || e.way_ids?.includes(wid) || Object.values(e.traversals ?? {}).some(t => t.source_way_ids?.includes(wid));
  const within = (coords,id,limit) => {
    const lines=city(id)?.the_geom?.coordinates;
    if (!lines?.length || !Array.isArray(coords) || coords.length<2) return false;
    return coords.every((p,i) => {
      if (!p?.every(Number.isFinite)) return false;
      const a=i ? coords[i-1] : p, count=Math.max(1,Math.ceil(metres(a,p)));
      return Array.from({length:count+1},(_,j) => [a[0]+(p[0]-a[0])*j/count,a[1]+(p[1]-a[1])*j/count]).every(q => Math.min(...lines.map(line => locate(q,line).distance))<=limit);
    });
  };
  for (const [name,id] of Object.entries(expected)) {
    const rs=routes(id);
    check(`remaining-south-${name}-scope`,true,city(id)?.displayrou==='Neighborhood Greenway' && rs.length===1 && rs[0].source_ids.filter(x=>x===id).length===1, 'Exact city source occurs once in a route component.',[sourceUrl]);
    check(`remaining-south-${name}-evidence`,true,!!evidence(id),'The source row retains an actionable source-inferred review record.',[sourceUrl]);
    const road=edges(id).filter(e=>e.role!=='gap');
    check(`remaining-south-${name}-geometry`,true,road.every(e=>within(e.geometry?.coordinates,id,18)) && (road.length>0 || gap(id)),'Every selected edge stays close to the exact city line at one-metre intervals, or the row remains an evidenced unknown gap.',[sourceUrl]);
  }
  const cycle=way(149987537), pEdges=edges(expected.plymouth);
  const cycleEdges=pEdges.filter(e=>e.way_id===149987537);
  const cycleCoords=cycle?.nodes.map(n=>node(n)?.coord);
  const exactUnknown=cycleEdges.length>0 && cycleEdges.every(e=>['forward','reverse'].every(d=>e.access?.[d]?.status==='unknown') && e.geometry.coordinates.every(p=>locate(p,cycleCoords).distance<0.1)) && cycleCoords && [cycleCoords[0],cycleCoords.at(-1)].every(p=>cycleEdges.some(e=>e.geometry.coordinates.some(q=>metres(p,q)<0.1))) && routes(expected.plymouth).every(r=>r.runs.every(run=>run.edge_ids.every(id=>!cycleEdges.some(e=>e.id===id))));
  const cycleGap=pEdges.some(e=>e.role==='gap' && ['forward','reverse'].every(d=>e.access?.[d]?.status==='unknown') && cycleCoords?.every(p=>locate(p,e.geometry.coordinates).distance<8));
  check('remaining-south-plymouth-noncar-gap',true,cycle?.tags.highway==='cycleway' && cycle.nodes[0]===1629279600 && cycle.nodes.at(-1)===1629279599 && node(1629279600)?.tags.noexit==='yes' && node(1629279599)?.tags.noexit==='yes' && !!(exactUnknown || (!cycleEdges.length && cycleGap)) && evidence(expected.plymouth), 'The exact cycleway is unknown to cars and excluded from runs, or its exact location remains an unknown gap.',[sourceUrl,osm(149987537)]);
  const nWays=[24105922,1305997716,1305998748,1305998749].map(way);
  const cityLine=city(expected.ninth)?.the_geom?.coordinates?.[0];
  const fullWest=[...nWays[3].nodes,...nWays[1].nodes.slice(1)].map(n=>node(n)?.coord);
  check('remaining-south-ninth-divided-unresolved',true,!!cityLine && nWays.every(w=>w?.tags.oneway==='yes') && nWays[0].nodes[0]===nWays[1].nodes.at(-1) && nWays[0].nodes.at(-1)===nWays[2].nodes[0] && nWays[2].nodes.at(-1)===nWays[3].nodes[0] && nWays[3].nodes.at(-1)===nWays[1].nodes[0] && !within(fullWest,expected.ninth,5) && gap(expected.ninth) && !edges(expected.ninth).some(e=>Object.values(e.traversals ?? {}).some(t=>(t.source_way_ids??[]).some(id=>[24105922,1305997716,1305998748,1305998749].includes(id)) && t.access?.status==='allowed')), 'The west arm exceeds five metres from the city line, and the East/West named ways cannot be silently combined by the split matcher; retain an unknown gap.',[sourceUrl,...[24105922,1305997716,1305998748,1305998749].map(osm)]);
  for (const wid of [24090563,1254538093]) {
    const w=way(wid), selected=edges(expected.avenueJ).filter(e=>touches(e,wid));
    const north=w && node(w.nodes.at(-1)).coord[1]>node(w.nodes[0]).coord[1];
    const conflict=selected.length>0 && selected.every(e=>['forward','reverse'].every(d=>e.access?.[d]?.status==='unknown' && e.access[d].evidence_status==='conflicting'));
    check(`remaining-south-avenue-j-${wid}-conflict`,true,city(expected.avenueJ)?.oneway_dir==='S' && w?.tags.oneway==='yes' && w.tags['oneway:bicycle']==='no' && !!north && (conflict || (!selected.length && gap(expected.avenueJ))), 'Northbound OSM motor one-way contradicts the city southbound assertion; both directions remain conflicting unknown or the entire match is unresolved.',[sourceUrl,osm(wid)]);
  }
  const pair=[33263148,1323980332], pairWays=pair.map(way), split=edges(expected.hundredth).filter(e=>pair.every(id=>touches(e,id)));
  const arms=pairWays.map(w=>w?.nodes.map(n=>node(n)?.coord));
  const length=arms.reduce((sum,a)=>sum+(a??[]).slice(1).reduce((s,p,i)=>s+metres(a[i],p),0),0);
  const sourcePair=pairWays.every(w=>w?.tags.oneway==='yes' && w.tags.name==='East 100th Street') && pairWays[0].nodes[0]===pairWays[1].nodes.at(-1) && pairWays[0].nodes.at(-1)===pairWays[1].nodes[0] && pairWays[0].nodes.slice(1,-1).every(n=>!pairWays[1].nodes.includes(n)) && length<=250 && arms.every(a=>within(a,expected.hundredth,8));
  const paths=split.length>0 && split.every(e=>e.matching?.method==='explicit-city-split-carriageway' && ['forward','reverse'].every(d=>e.traversals?.[d]?.access?.status==='allowed') && pair.every(id=>Object.values(e.traversals).some(t=>t.source_way_ids?.includes(id))));
  const unresolvedPair=routes(expected.hundredth).some(r=>r.matching_review?.source_ids?.includes(expected.hundredth) && typeof r.matching_review.reason==='string' && r.matching_review.reason.trim() && r.edges.some(e=>e.role==='gap' && ['forward','reverse'].every(d=>e.access?.[d]?.status==='unknown') && arms[0].every(p=>locate(p,e.geometry.coordinates).distance<=8)) && !r.edges.some(e=>pair.some(id=>touches(e,id))));
  check('remaining-south-hundredth-opposed-arms',true,!!sourcePair && (paths || !!unresolvedPair), 'The opposite 100th arms share endpoints, remain disjoint and satisfy 8 m/250 m bounds; selected traversals must retain the two actual source paths.',[sourceUrl,...pair.map(osm)]);
  check('remaining-south-hundredth-dogleg',true,way(1527992426)?.nodes[0]===261146683 && way(1527992426).nodes.at(-1)===13924444111 && way(24090563)?.nodes[0]===261146683 && (edges(expected.hundredth).some(e=>touches(e,1527992426)) || gap(expected.hundredth)), 'The designated 100th dogleg connects to Avenue J at the mapped junction; do not use an off-route bypass.',[sourceUrl,osm(1527992426),osm(24090563)]);
  for (const [name,id,ids] of [['nineteenth',expected.nineteenth,[1061159303]],['douglas',expected.douglas,[24076371]],['hundredFifth',expected.hundredFifth,[33261389,865545074]],['hundredFourth',expected.hundredFourth,[865545078,146306494]],['montgomery',expected.montgomery,[24105072]]]) {
    for (const wid of ids) {
      const w=way(wid), raw=w?.nodes.map(n=>node(n)?.coord), selected=edges(id).filter(e=>e.way_id===wid);
      const valid=selected.length>0 && selected.every(e=>{
        const points=e.geometry?.coordinates, first=points?.[0], last=points?.at(-1);
        if (!first || !last || !raw?.every(Boolean) || !within(points,id,18) || locate(first,raw).distance>1 || locate(last,raw).distance>1) return false;
        const forward=locate(last,raw).position>locate(first,raw).position;
        return e.access?.[forward?'forward':'reverse']?.status==='allowed' && e.access?.[forward?'reverse':'forward']?.status==='blocked';
      });
      check(`remaining-south-${name}-${wid}-direction`,true,w?.tags.oneway==='yes' && (valid || (!selected.length && gap(id))), 'Selected geometry is clipped to the mapped way and follows its motor one-way; otherwise retain an unknown gap.',[sourceUrl,osm(wid)]);
    }
  }
  const douglas=way(24076371);
  check('remaining-south-douglas-14th-identity',true,douglas?.tags.name==='West 14th Street' && douglas.nodes[0]===261145378 && douglas.nodes.at(-1)===261145377 && within(douglas.nodes.map(n=>node(n)?.coord),expected.douglas,8) && (edges(expected.douglas).some(e=>touches(e,24076371)) || gap(expected.douglas)), 'The city Douglas row follows explicitly identified OSM West 14th Street between Hamlin and Ridgeway.',[sourceUrl,osm(24076371)]);
  const w97=way(146306506), selected97=edges(expected.ninetySeventh).filter(e=>e.way_id===146306506);
  check('remaining-south-ninetyseventh-direction',true,!!w97 && !['oneway','access','vehicle','motor_vehicle','motorcar'].some(k=>w97.tags[k]) && (selected97.length ? selected97.every(e=>['forward','reverse'].every(d=>e.access?.[d]?.status==='allowed')) : gap(expected.ninetySeventh)), 'The mapped 97th way has no explicit direction or motor access tag; selected travel follows both inferred directions.',[sourceUrl,osm(146306506)]);
}
