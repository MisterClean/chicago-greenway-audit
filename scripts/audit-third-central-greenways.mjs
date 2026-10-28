import { lineLength } from './route-network.mjs';

// Independent checks of city row scope and the staged source geometry, not field approval.
export function auditThirdCentralGreenways({data, db, cityRecords, evidenceRecords, check, sourceUrl}) {
  const families = {
    Dearborn: ['row-gdhc-hkkb.h3bg', 'row-gv83~kyug~tfd8'],
    Sunnyside: ['row-vy8z-r7yn_5ka7', 'row-b8mz_gyug-txux'],
    Rosehill: ['row-hn8n_vc6q_m8wd'],
  };
  const city = id => cityRecords.find(r => r[':id'] === id);
  const route = name => data.routes.find(r => r.name === name);
  const way = id => {
    const row = db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id);
    return row && {nodes: JSON.parse(row.nodes), tags: JSON.parse(row.tags)};
  };
  const node = id => db.prepare('SELECT lon,lat FROM nodes WHERE id=?').get(id);
  const url = id => `https://www.openstreetmap.org/way/${id}`;
  for (const [name, ids] of Object.entries(families)) {
    const found = data.routes.filter(r => r.name === name).flatMap(r => r.source_ids);
    check(`third-central-${name.toLowerCase()}-scope`, true,
      found.length === ids.length && ids.every(id => city(id)?.displayrou === 'Neighborhood Greenway' && found.filter(x => x === id).length === 1) && found.every(id => ids.includes(id)),
      'Exactly the independently enumerated city greenway rows occur once.', [sourceUrl]);
  }
  const dear = way(31009529), de = route('Dearborn')?.edges.filter(e => e.way_id === 31009529) ?? [];
  const dstart = node(261171336), dmid = node(261171337), dend = node(12915002704);
  check('third-central-dearborn-both-directions', true,
    families.Dearborn.every(id => city(id)?.oneway_dir === '-') && !!dear && !dear.tags.oneway && dear.nodes.indexOf(261171336) < dear.nodes.indexOf(261171337) && dear.nodes.indexOf(261171337) < dear.nodes.indexOf(12915002704) && !!dstart && !!dmid && !!dend && dstart.lat < dmid.lat && dmid.lat < dend.lat && de.length > 0 && de.every(e => ['forward','reverse'].every(d => e.access[d].status === 'allowed' && e.access[d].evidence_status === 'source-inferred')),
    'City direction is blank; source node order and missing one-way tag support both snapshot directions only.', [sourceUrl,url(31009529)]);
  const sun = way(24165992), se = route('Sunnyside')?.edges.filter(e => e.way_id === 24165992) ?? [];
  const west = node(264413978), east = node(153011804);
  check('third-central-sunnyside-oneway', true,
    city(families.Sunnyside[0])?.oneway_dir === '-' && city(families.Sunnyside[1])?.oneway_dir === 'E' && sun?.nodes[0] === 264413978 && sun?.nodes.at(-1) === 153011804 && !!west && !!east && west.lon < east.lon && sun.tags.oneway === 'yes' && sun.tags['oneway:bicycle'] === 'no' && se.length > 0 && se.every(e => e.access.forward.status === 'allowed' && e.access.reverse.status === 'blocked'),
    'The city blank on the western row does not erase the eastbound motor rule and westbound bicycle exception on the eastern row.', [sourceUrl,url(24165992)]);
  const ring = way(1535609224), r = route('Rosehill');
  const index = r?.edges.findIndex(e => e.way_id === 1535609224 && e.role === 'junction') ?? -1;
  const edge = r?.edges[index], start = 10943460512, end = 13990554011;
  function arc(a,b) {
    if (!ring || ring.nodes[0] !== ring.nodes.at(-1)) return [];
    const ns = ring.nodes.slice(0,-1), i = ns.indexOf(a), j = ns.indexOf(b);
    if (i < 0 || j < 0) return [];
    const result = [a];
    for (let k = (i+1)%ns.length; k !== j; k=(k+1)%ns.length) { result.push(ns[k]); if (result.length > ns.length) return []; }
    return [...result,b];
  }
  const expectedArcs = [
    [10943460512,13990548400,13990548399,13990548398,13990548397,13990554019,13990554018,13990554017,13990554016,13990554015,13990554014,13990554013,13990554012,13990554011],
    [13990554011,13990554010,13990554009,13990554008,13990554007,13990554006,13990554005,13990554004,13990554003,13990554002,13990554001,10943460512],
  ];
  const attached = index > 0 && index < r.edges.length-1 && edge.from_node === start && edge.to_node === end && r.edges[index-1].to_node === start && r.edges[index-1].way_id === 678895681 && r.edges[index+1].from_node === end && r.edges[index+1].way_id === 24093741 && way(678895681)?.nodes[0] === start && way(24093741)?.nodes.at(-1) === end;
  const arcsValid = [[start,end],[end,start]].every(([a,b],i) => {
    const ns = arc(a,b), points = ns.map(node), coords = points.map(p => p && [p.lon,p.lat]), t = edge?.traversals?.[i ? 'reverse' : 'forward'];
    return JSON.stringify(ns) === JSON.stringify(expectedArcs[i]) && points.every(Boolean) && JSON.stringify(coords) === JSON.stringify(t?.geometry?.coordinates) && JSON.stringify(t?.source_way_ids) === JSON.stringify([1535609224]) && t?.access?.status === 'allowed' && Math.abs(t.length_m-lineLength(coords)) < 0.001;
  });
  check('third-central-rosehill-circle', true, !!attached && ring?.tags.oneway === 'yes' && !!arcsValid && evidenceRecords.some(e => e.id === 'rosehill-through-circle' && e.source_record_ids?.includes(families.Rosehill[0]) && e.way_ids?.includes(1535609224)),
    'Both exact source-node arcs attach to the named roads, retain their separate geometries and measured lengths, and follow the one-way circle.', [sourceUrl,url(1535609224),url(678895681),url(24093741)]);
  const rr = db.prepare('SELECT members,tags FROM relations WHERE id=?').get(9454355);
  const members = rr && JSON.parse(rr.members), tags = rr && JSON.parse(rr.tags);
  const exact = [{type:'way',ref:681310579,role:'from'},{type:'node',ref:257172600,role:'via'},{type:'way',ref:678895681,role:'to'}];
  const noApproach = !!r && r.edges.every(e => e.way_id !== 681310579 && !(e.way_ids ?? []).includes(681310579)) && r.movements.every(m => !JSON.stringify(m).includes('relation/9454355'));
  check('third-central-rosehill-approach-restriction', true, tags?.restriction === 'no_right_turn' && JSON.stringify(members) === JSON.stringify(exact) && noApproach,
    'The mapped restriction applies to an incoming Ravenswood approach, not a Rosehill through movement.', ['https://www.openstreetmap.org/relation/9454355',sourceUrl]);
}
