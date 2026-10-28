// Independent audit of saved city and OSM snapshots; current signs require field review.
import { locate, metres } from './route-network.mjs';

export function auditRemainingCentral({ data, db, cityRecords, evidenceRecords, check, sourceUrl }) {
  const ids = {
    sacramento:'row-ikjv.59qa_rhpx', alley:'row-v8nm_gcrv.3qmh', richmond:'row-5w95~i36u-q5b6',
    harding:'row-9dbi.qgtu~phcd', kedvaleRoscoe:'row-whn5~y4c5.ih47', kedvaleCarmen:'row-px7u.ngw2.3miv',
    loganEast:'row-cdds.7qag~3ksj', loganWest:'row-w6ce_auic-ahse', campbell:'row-e2ij~bhix_rq9s', magnolia:'row-ze8s_fkku-pz9v',
  };
  const city = id => cityRecords.find(r => r[':id'] === id);
  const routes = id => data.routes.filter(r => r.source_ids.includes(id));
  const way = id => { const row = db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id); return row && {nodes:JSON.parse(row.nodes),tags:JSON.parse(row.tags)}; };
  const coord = id => { const n = db.prepare('SELECT lon,lat FROM nodes WHERE id=?').get(id); return n && [n.lon,n.lat]; };
  const url = id => `https://www.openstreetmap.org/way/${id}`;
  const edges = (id,wid) => routes(id).flatMap(r => r.edges.filter(e => e.way_id === wid));
  const hasWay = (e,wid) => e.way_id === wid || e.way_ids?.includes(wid) || Object.values(e.traversals ?? {}).some(t => t.source_way_ids?.includes(wid));
  const matchingEvidence = (id,wid) => evidenceRecords.some(e => e.source_record_ids?.includes(id) && e.way_ids?.includes(wid) && e.review_status === 'source-inferred' && typeof e.review_needed === 'string' && e.review_needed.trim());
  for (const [name,id] of Object.entries(ids)) {
    const rs = routes(id);
    check(`remaining-central-${name}-scope`,true,cityRecords.filter(r => r[':id'] === id && r.displayrou === 'Neighborhood Greenway').length === 1 && rs.length === 1 && rs[0].source_ids.filter(v => v === id).length === 1,
      'The exact designated city record appears once, regardless of route family.',[sourceUrl]);
  }
  check('remaining-central-evidence',true,Object.values(ids).every(id => evidenceRecords.some(e => e.source_record_ids?.includes(id) && e.review_status === 'source-inferred' && typeof e.review_needed === 'string' && e.review_needed.trim())),
    'Every exact row has scoped source-inferred evidence and outstanding review.',[sourceUrl]);

  // Compare against raw OSM node order, not the component's compass label.
  for (const [name,id,wid,axis,sign] of [
    ['sacramento',ids.sacramento,164646139,'lat',-1], ['richmond',ids.richmond,24106579,'lat',1],
    ['harding',ids.harding,1352380485,'lat',-1], ['logan-east',ids.loganEast,1284491333,'lon',1],
    ['logan-west-a',ids.loganWest,24102755,'lon',-1], ['logan-west-b',ids.loganWest,1284491332,'lon',-1],
    ['campbell',ids.campbell,406711334,'lat',1], ['magnolia',ids.magnolia,583450010,'lat',1],
  ]) {
    const w=way(wid), raw=w?.nodes.map(coord), selected=edges(id,wid), component=axis === 'lat' ? 1 : 0;
    const cardinal = axis === 'lat' ? (sign > 0 ? 'N' : 'S') : (sign > 0 ? 'E' : 'W');
    const sourceOK = city(id)?.oneway_dir === cardinal && w?.tags.oneway === 'yes' && raw?.every(Boolean) && Math.sign(raw.at(-1)[component]-raw[0][component]) === sign;
    const exportedOK = selected.length > 0 && selected.every(e => {
      const p=e.geometry?.coordinates?.[0], q=e.geometry?.coordinates?.at(-1);
      if (!p || !q || !raw?.every(Boolean)) return false;
      const follows=locate(q,raw).position > locate(p,raw).position;
      const along=e.access?.[follows?'forward':'reverse'], against=e.access?.[follows?'reverse':'forward'];
      return along?.status !== 'blocked' && against?.status !== 'allowed' && (against?.status === 'blocked' || against?.evidence_status === 'conflicting');
    });
    check(`remaining-central-${name}-motor-direction`,true,!!sourceOK && exportedOK && matchingEvidence(id,wid),
      'Mapped motor one-way follows OSM node order; an opposing direction cannot become allowed through a bicycle exception or city conflict.',[sourceUrl,url(wid)]);
  }
  const rs=routes(ids.sacramento)[0], ra=routes(ids.alley)[0], rr=routes(ids.richmond)[0];
  const sac=way(164646139), alley=way(32709496), rich=way(24106579);
  const index=(w,n)=>w?.nodes.indexOf(n) ?? -1;
  const order=(w,a,b)=>index(w,a)>=0 && index(w,a)<index(w,b);
  const endpoints = [261268624,368085341,368085338,261268625].map(coord);
  const westbound = endpoints.every(Boolean) && endpoints[0][0]>endpoints[3][0] && order(rich,261268624,368085341) && order(sac,368085338,261268625) && alley?.nodes[0]===368085338 && alley.nodes.at(-1)===368085341;
  const bound = [[ids.sacramento,164646139],[ids.alley,32709496],[ids.richmond,24106579]].every(([id,w]) => matchingEvidence(id,w) && edges(id,w).length > 0 && edges(id,w).every(e => e.matching?.city_source_ids?.includes(id)));
  check('remaining-central-berteau-dogleg',true,!!rs && rs===ra && ra===rr && westbound && bound,
    'The three city records share one designated route; Richmond to alley to Sacramento runs geographically west and follows both staged street one-ways. Alley access and turns remain separately reviewable.',[sourceUrl,...[164646139,32709496,24106579].map(url)]);

  const east=city(ids.loganEast)?.the_geom.coordinates[0], camp=city(ids.campbell)?.the_geom.coordinates[0], west=city(ids.loganWest)?.the_geom.coordinates[0];
  const arterial=way(1093913559), loganRoutes=[...new Set([...routes(ids.loganEast),...routes(ids.loganWest),...routes(ids.campbell)])];
  const separated=!!east && !!camp && !!west && metres(east.at(-1),camp[0]) < 0.01 && metres(camp.at(-1),west[0]) > 30 && arterial?.nodes[0]===260098465 && arterial.nodes.at(-1)===263330690;
  check('remaining-central-logan-campbell-nonjoin',true,!!separated && loganRoutes.every(r => r.edges.every(e => !hasWay(e,1093913559))) && routes(ids.campbell).every(r => !r.source_ids.includes(ids.loganWest)),
    'Campbell meets east Logan in the city source; west Logan starts separately. The intervening arterial is outside the designation and must not be silently inserted.',[sourceUrl,url(1093913559)]);

  const ked=way(1449901719), stem=way(563963346), kline=city(ids.kedvaleRoscoe)?.the_geom.coordinates[0];
  const kr=routes(ids.kedvaleRoscoe)[0], ke=kr?.edges.filter(e => [563963346,1449901719].includes(e.way_id)) ?? [];
  const stemRaw=stem?.nodes.map(coord), roscoeRaw=ked?.nodes.map(coord);
  const sampledWithin = e => e.geometry.coordinates.every((p,i,points) => {
    const a=i ? points[i-1] : p, steps=Math.max(1,Math.ceil(metres(a,p)));
    return Array.from({length:steps+1},(_,j)=>[a[0]+(p[0]-a[0])*j/steps,a[1]+(p[1]-a[1])*j/steps]).every(q=>locate(q,kline).distance<11);
  });
  const stemEnd=ke.findLastIndex(e=>e.way_id===563963346), firstRoscoe=ke.findIndex(e=>e.way_id===1449901719);
  const chain=ke.length>1 && stemEnd>=0 && firstRoscoe===stemEnd+1 && ke[stemEnd].to_node===261139126 && ke[firstRoscoe].from_node===261139126 && stem?.nodes.at(-1)===261139126 && ked?.nodes.includes(261139126) && ke.every(sampledWithin);
  const clippedEnds=chain && stemRaw?.every(Boolean) && roscoeRaw?.every(Boolean) &&
    Math.abs(locate(ke[0].geometry.coordinates[0],stemRaw).position-locate(kline.at(-1),stemRaw).position)<0.1 &&
    Math.abs(locate(ke.at(-1).geometry.coordinates.at(-1),roscoeRaw).position-locate(kline[0],roscoeRaw).position)<0.1;
  const status=ke.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked');
  check('remaining-central-kedvale-roscoe-boundary',true,!!(ked?.tags.name==='West Roscoe Street' && stem?.tags.oneway==='yes' && ked?.tags.oneway==='yes' && chain && clippedEnds && status && matchingEvidence(ids.kedvaleRoscoe,1449901719)),
    'Kedvale and Roscoe share a staged node and form a clipped, source-bounded north/east one-way chain; sampled points stay within 11 m of the city line.',[sourceUrl,url(563963346),url(1449901719)]);

  const mag=way(1237331790), me=edges(ids.magnolia,1237331790);
  check('remaining-central-magnolia-conflict',true,city(ids.magnolia)?.oneway_dir==='N' && !!mag && !mag.tags.oneway && me.length>0 && me.every(e => Object.values(e.access ?? {}).some(a => a.status==='unknown' && a.evidence_status==='conflicting')),
    'City northbound direction conflicts with the missing OSM motor one-way on the southern Magnolia way; preserve the opposing direction as unknown, not allowed.',[sourceUrl,url(1237331790)]);
}
