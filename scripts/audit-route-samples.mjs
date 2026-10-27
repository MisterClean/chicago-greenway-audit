// Independent snapshot consistency checks, not field or legal validation.
// node scripts/audit-route-samples.mjs [input.json] [output.json] [network.sqlite]
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { metres, locate } from './route-network.mjs';

const [input = 'public/routes/pilot.json', output = 'data/routes/pilot-validation.json', database = 'data/staging/network.sqlite'] = process.argv.slice(2);
const bytes = await readFile(input);
const data = JSON.parse(bytes);
const db = new DatabaseSync(database, { readOnly: true });
const getNode = db.prepare('SELECT tags FROM nodes WHERE id=?');
const getWay = db.prepare('SELECT nodes,tags FROM ways WHERE id=?');
const restrictions = [...db.prepare('SELECT id,members,tags FROM relations').iterate()].map(r => ({ id: r.id, members: JSON.parse(r.members), tags: JSON.parse(r.tags) })).filter(r => r.tags.type === 'restriction' || Object.keys(r.tags).some(k => k.startsWith('restriction')));
const viaNodes = new Set();
const viaWays = new Set();
for (const r of restrictions) for (const m of r.members) if (m.role === 'via') (m.type === 'node' ? viaNodes : viaWays).add(m.ref);
const wayRestrictions = new Set(restrictions.filter(r => r.members.some(m => m.role === 'via' && m.type === 'way')).flatMap(r => r.members.filter(m => m.type === 'way').map(m => m.ref)));
const samples = [], skips = [];
const sourceUrl = 'https://data.cityofchicago.org/Transportation/Bike-Routes/hvv9-38ut';
const cityRecords = JSON.parse(await readFile('data/sources/greenways.json', 'utf8'));
const cityRecord = id => cityRecords.find(r => r[':id'] === id);
function relevantNode(tags) { return Object.keys(tags).some(k => /^(barrier|access|vehicle|motor_vehicle|motorcar|hgv|bicycle|oneway|restriction)(:|$)/.test(k) || k.includes('conditional')); }
for (const route of data.routes) {
  const edges = new Map(route.edges.map(e => [e.id, e]));
  const candidates = [];
  for (let i = 0; i < route.movements.length; i++) {
    const m = route.movements[i], a = edges.get(m.from_edge), b = edges.get(m.to_edge);
    if (!a || !b || !a.way_id || a.way_id !== b.way_id || a.to_node == null || a.to_node !== b.from_node) continue;
    if (a.role !== 'designated' || b.role !== 'designated' || m.junction_traversal || a.junction_traversal || b.junction_traversal || /junction|circle|roundabout/i.test(JSON.stringify([a.role,b.role,m.kind ?? '']))) continue;
    const n = getNode.get(a.to_node), w = getWay.get(a.way_id);
    if (!n || !w || viaNodes.has(a.to_node) || viaWays.has(a.way_id) || wayRestrictions.has(a.way_id)) continue;
    const tags = JSON.parse(n.tags), wt = JSON.parse(w.tags), ids = JSON.parse(w.nodes);
    if (relevantNode(tags) || Object.keys(wt).some(k => k.includes('conditional')) || wt.junction) continue;
    const positions = ids.flatMap((id, j) => id === a.to_node ? [j] : []);
    if (!positions.some(j => (ids[j-1] === a.from_node && ids[j+1] === b.to_node) || (ids[j+1] === a.from_node && ids[j-1] === b.to_node))) continue;
    candidates.push({i,m,a,b,node:a.to_node});
  }
  // Select distinct eligible nodes nearest the two route-index quartiles, not by observed result.
  const selected = [];
  for (const fraction of [0.25, 0.75]) {
    const options = candidates.filter(c => !selected.some(s => s.node === c.node));
    options.sort((a,b) => Math.abs(a.i - fraction * (route.movements.length - 1)) - Math.abs(b.i - fraction * (route.movements.length - 1)) || a.i - b.i);
    if (options.length) selected.push(options[0]);
  }
  if (selected.length < 2) skips.push({route_id:route.id, reason:'Fewer than two independently eligible distinct same-way junctions.', eligible_count:candidates.length, selected_count:selected.length});
  for (const c of selected) for (const direction of ['forward','reverse']) {
    const observed = c.m[direction]?.status ?? null;
    samples.push({id:`${c.m.id}-${direction}`,route_id:route.id,subject:'movement',movement_id:c.m.id,direction,from_edge:direction === 'forward' ? c.a.id : c.b.id,to_edge:direction === 'forward' ? c.b.id : c.a.id,via_node_id:c.node,source_way_id:c.a.way_id,expected_movement_status:'allowed',observed_movement_status:observed,result:observed === 'allowed' ? 'pass':'fail',basis:'Adjacent segments of the same source way and node, with no relevant node tag, via-node restriction, via-way restriction or conditional way tag in the snapshot. Junction rule only; this does not establish edge access or current legality.',sources:[`https://www.openstreetmap.org/way/${c.a.way_id}`,`https://www.openstreetmap.org/node/${c.node}`],field_reviewed:false});
  }
}
const checks = [];
function check(id, expected, observed, basis, sources = []) { checks.push({id,expected,observed,result:JSON.stringify(expected) === JSON.stringify(observed) ? 'pass':'fail',basis,sources,field_reviewed:false}); }
function skip(id, reason) { skips.push({id,reason}); }
for (const id of [1444797397,1444797396]) {
  const edges = data.routes.filter(r => r.name === 'Wood').flatMap(r => r.edges.filter(e => e.way_id === id));
  const way = getWay.get(id);
  if (!way || !edges.length) { skip(`wood-${id}`,'Way or exported edge absent.'); continue; }
  const tags = JSON.parse(way.tags), nodes = JSON.parse(way.nodes), first = getNode.get(nodes[0]);
  check(`wood-${id}-source`, 'yes', tags.oneway ?? null, 'Snapshot motor one-way; bicycle exception does not grant motor access.', [`https://www.openstreetmap.org/way/${id}`,'https://www.the1stward.com/woodst']);
  for (const direction of ['forward','reverse']) check(`wood-${id}-${direction}`, [direction === 'forward' ? 'blocked':'allowed'], [...new Set(edges.map(e=>e.access[direction].status))], 'Route runs northbound; ward project specifies southbound conversion, snapshot is checked separately. Current signs require review.', [`https://www.openstreetmap.org/way/${id}`,'https://www.the1stward.com/woodst']);
}
const relation = restrictions.find(r => r.id === 20163015);
const lm = data.routes.filter(r=>r.name === 'Leland').flatMap(r=>r.movements).filter(m=>JSON.stringify(m.forward).includes('relation/20163015'));
if (relation && lm.length) {
  check('leland-western-relation', 'no_straight_on', relation.tags.restriction ?? null, 'Snapshot restriction relation, not evidence of current physical installation.', ['https://www.openstreetmap.org/relation/20163015','https://40thward.org/project/leland-greenway-2/']);
  check('leland-western-eastbound', ['blocked'], [...new Set(lm.map(m=>m.forward.status))], 'Checks the approach-specific exported movement.', ['https://www.openstreetmap.org/relation/20163015']);
} else skip('leland-western-relation','Relation or its exported movement absent.');
// Inventory possible physical filters without asserting whether an unexamined node blocks a through route.
for (const name of ['Kenmore','George','Glenwood','Loomis','124th']) {
  const routes = data.routes.filter(r => r.name.toLowerCase() === name.toLowerCase());
  if (!routes.length) { skip(name.toLowerCase(),'Route absent from input.'); continue; }
  const rows = routes.flatMap(r => r.edges.map(e => ({r,e})));
  if (name === 'George') {
    const statuses = [...new Set(rows.filter(({e})=>e.way_id && e.role === 'designated').map(({e})=>e.access.reverse.status))].sort();
    checks.push({id:'george-westbound-inventory',observed:statuses,result:'review',basis:'City identifies eastbound one-way; inspect each matched edge and current signs before treating the whole corridor as blocked.',sources:[sourceUrl],field_reviewed:false});
  }
  if (name === 'Kenmore') {
    const ids = [...new Set(rows.flatMap(({e})=>[e.from_node,e.to_node]).filter(x=>x != null))];
    const barriers = ids.flatMap(id=>{const n=getNode.get(id); if(!n)return []; const t=JSON.parse(n.tags); return t.barrier ? [{node_id:id,barrier:t.barrier,tags:t}] : [];});
    checks.push({id:'kenmore-barrier-node-inventory',observed:barriers,result:'review',basis:'Inventory only: inspect the node, its crossing movements and both physical openings before deciding car access.',sources:barriers.map(n=>`https://www.openstreetmap.org/node/${n.node_id}`),field_reviewed:false});
  }
  if (name === 'Glenwood') {
    const circles = rows.filter(({e})=>e.way_id && (()=>{const w=getWay.get(e.way_id);return w && JSON.parse(w.tags).junction;})());
    checks.push({id:'glenwood-junction-arc-inventory',observed:circles.map(({r,e})=>({route_id:r.id,edge_id:e.id,way_id:e.way_id,from_node:e.from_node,to_node:e.to_node,forward:e.access.forward.status,reverse:e.access.reverse.status})),result:'review',basis:'Inspect ring traversal source IDs and distinct direction-specific arcs; this inventory does not approve either arc.',sources:[...new Set(circles.map(({e})=>`https://www.openstreetmap.org/way/${e.way_id}`))],field_reviewed:false});
  }
  if (name === 'Loomis' || name === '124th') checks.push({id:`${name.toLowerCase()}-scope-and-gap-inventory`,observed:routes.map(r=>({route_id:r.id,extent_label:r.extent_label,source_ids:r.source_ids,gaps:r.edges.filter(e=>e.role==='gap').map(e=>({id:e.id,geometry:e.geometry}))})),result:'review',basis:name === 'Loomis' ? 'Inspect 95th crossing for artificial alignment gaps and retain real uncertainty.' : 'Check source designation endpoints; an endpoint is not a physical barrier.',sources:[sourceUrl],field_reviewed:false});
}
// Targeted assertions for known snapshot cases. These are consistency checks, not field approvals.
const ken = data.routes.find(r=>r.name==='Kenmore');
if (ken) for (const id of [7613384009,7610489575]) {
  const node = getNode.get(id), tags = node && JSON.parse(node.tags);
  const movements = ken.movements.filter(m=>m.evidence_urls?.includes(`https://www.openstreetmap.org/node/${id}`));
  check(`kenmore-bollard-${id}-source`, 'bollard', tags?.barrier ?? null, 'Source tag is a physical-filter inference; current openings and signs need field review.', [`https://www.openstreetmap.org/node/${id}`]);
  check(`kenmore-bollard-${id}-movement`, ['blocked','blocked'], movements.length === 1 ? [movements[0].forward.status,movements[0].reverse.status] : [], 'Both snapshot movements retain node-specific physical restriction.', [`https://www.openstreetmap.org/node/${id}`]);
}
const george = data.routes.find(r=>r.name==='George');
if (george) {
  const road = george.edges.filter(e=>e.role==='designated' && e.way_id);
  check('george-east-only', ['allowed','blocked'], road.length ? [...new Set(road.map(e=>e.access.forward.status)), ...new Set(road.map(e=>e.access.reverse.status))] : [], 'Checks matched edge statuses against city eastbound direction; no field approval.', [sourceUrl]);
}
const glen = data.routes.find(r=>r.id==='glenwood-1');
if (glen) {
  for (const [ids, expected] of [[[1535615713,1535615717],['allowed','unknown']],[[1535615712,1535615714],['allowed','unknown']],[[1535607613],['allowed','allowed']]]) {
    const edge = glen.edges.find(e=>e.role==='junction' && ids.every(id=>e.way_ids?.includes(id)));
    const label=ids.join('-');
    check(`glenwood-ring-${label}-statuses`,expected,edge ? [edge.access.forward.status,edge.access.reverse.status] : [],'Checks source-inferred directional traversal statuses; actual signs and circulation need review.',ids.map(id=>`https://www.openstreetmap.org/way/${id}`));
    if (!edge) continue;
    for (const dir of ['forward','reverse']) {
      const t=edge.traversals?.[dir];
      const sources=t?.source_way_ids ?? [];
      const valid=!!t && t.length_m>0 && sources.length>0 && sources.every(id=>ids.includes(id)) && sources.includes(t.entry_way_id) && sources.includes(t.exit_way_id) && t.access.status===edge.access[dir].status;
      check(`glenwood-ring-${label}-${dir}-provenance`,true,valid,'Traversal records direction-specific source ways, entry, exit, positive length and access.',ids.map(id=>`https://www.openstreetmap.org/way/${id}`));
    }
    if (ids.length===1) {
      const f=edge.traversals?.forward?.geometry?.coordinates, r=edge.traversals?.reverse?.geometry?.coordinates;
      check(`glenwood-ring-${label}-distinct-arcs`,true,!!f && !!r && JSON.stringify(f)!==JSON.stringify([...r].reverse()),'Forward and reverse paths use distinct arcs rather than reversing the same arc.',[`https://www.openstreetmap.org/way/${ids[0]}`]);
    }
  }
}
const loom = data.routes.find(r=>r.name==='Loomis');
if (loom) {
  const gap=loom.edges.filter(e=>e.role==='gap');
  const join=loom.edges.filter(e=>e.access.forward.reason.includes('crosses city records')); 
  check('loomis-95th-no-interior-gap',true,gap.every(e=>e===loom.edges[0] || e===loom.edges.at(-1)) && join.length>0 && join.every(e=>e.access.forward.status==='unknown'),'No interior alignment gap; city-record join forward direction remains unknown rather than being treated as open.',[sourceUrl]);
}
const south = data.routes.find(r=>r.name==='124th');
if (south) {
  check('124th-scope-end-both-directions',true,south.runs.length===2 && south.runs.every(r=>r.start.kind==='scope_end' && r.end.kind==='scope_end' && r.scope_limited),'Endpoints mark mapped designation limits, not physical barriers.',[sourceUrl]);
}
// New-corridor checks tie each assertion to city records or staged OSM tags and
// topology. These establish snapshot consistency, not present-day road rules.
const roscoe = data.routes.filter(r=>r.name==='Roscoe');
if (roscoe.length) {
  const west = cityRecord('row-sbv9-nemh.v8g9'), east = cityRecord('row-smjt~ezi2_sb5e');
  const wp=west?.the_geom.coordinates[0][0], ep=east?.the_geom.coordinates[0].at(-1);
  const westRoute=roscoe.find(r=>r.source_ids.includes(west?.[':id'])), eastRoute=roscoe.find(r=>r.source_ids.includes(east?.[':id']));
  const unknownNear=(r,p)=>r.runs.some(run=>[run.start,run.end].some(end=>end.kind==='unknown' && end.coordinate && metres(end.coordinate,p)<15));
  check('roscoe-broadway-city-separation',true,!!wp && !!ep && metres(wp,ep)>20 && !!westRoute && !!eastRoute && westRoute.id!==eastRoute.id && unknownNear(westRoute,wp) && unknownNear(eastRoute,ep), 'City records do not meet at Broadway; keep the intervening movement unresolved.',[sourceUrl]);
  check('roscoe-source-components',3,roscoe.length,'Three distinct city designation components remain separate in the export.',[sourceUrl]);
  const ids=[1535693373,1535693538], ws=ids.map(id=>getWay.get(id)), ring=roscoe.flatMap(r=>r.edges).find(e=>e.role==='junction' && ids.every(id=>e.way_ids?.includes(id)));
  const sourceRing=ws.every(Boolean) && ws.every(w=>{const t=JSON.parse(w.tags);return t.highway==='tertiary' && t.junction==='circular' && t.oneway==='yes';}) && (()=>{const a=JSON.parse(ws[0].nodes),b=JSON.parse(ws[1].nodes);return a[0]===b[0] && a.at(-1)===b.at(-1);})();
  check('roscoe-keeler-source-ring',true,sourceRing,'Staged unnamed tertiary ways share endpoints but both one-way sequences run the same way between them.',ids.map(id=>`https://www.openstreetmap.org/way/${id}`));
  check('roscoe-keeler-directional', ['allowed','unknown','conflicting'],ring ? [ring.access.forward.status,ring.access.reverse.status,ring.access.reverse.evidence_status] : [],'Eastbound ring path is inferred; inconsistent reverse circulation remains unresolved.',ids.map(id=>`https://www.openstreetmap.org/way/${id}`));
}
const winthrop=data.routes.find(r=>r.name==='Winthrop');
if (winthrop) {
  const before=getWay.get(1286431917), after=getWay.get(174711016);
  const gap=winthrop.edges.find(e=>e.role==='gap' && e.length_m>75 && e.length_m<90);
  const i=gap ? winthrop.edges.indexOf(gap) : -1;
  const bounds=gap && before && after && JSON.parse(before.nodes).includes(winthrop.edges[i-1]?.to_node) && JSON.parse(after.nodes).includes(winthrop.edges[i+1]?.from_node);
  check('winthrop-interior-gap',true,!!bounds && gap.access.forward.status==='unknown' && gap.access.reverse.status==='unknown' && winthrop.movements[i-1]?.forward.status==='unknown' && winthrop.movements[i]?.reverse.status==='unknown','The staged Winthrop ways end on opposite sides of the unmatched city segment; neither movement is inferred connected.',[sourceUrl,'https://www.openstreetmap.org/way/1286431917','https://www.openstreetmap.org/way/174711016']);
  const evidence=JSON.parse(await readFile('data/routes/review-evidence.json','utf8')).records.find(r=>r.id==='winthrop-goudy-gate-gap');
  const urls=evidence?.sources?.map(s=>s.url) ?? [], endpointGaps=winthrop.edges.filter(e=>e.role==='gap' && e!==gap);
  const within=!!gap && evidence?.gap_scope?.route_id===winthrop.id && evidence.source_record_ids?.some(id=>winthrop.source_ids.includes(id)) && gap.geometry.coordinates.every(([lon,lat])=>lon>=evidence.gap_scope.bounds[0][0] && lon<=evidence.gap_scope.bounds[1][0] && lat>=evidence.gap_scope.bounds[0][1] && lat<=evidence.gap_scope.bounds[1][1]);
  check('winthrop-goudy-gap-context',true,!!within && urls.length===2 && urls.every(url=>gap.evidence_urls.includes(url)) && gap.evidence_ids?.includes(evidence.id) && gap.review_note===evidence.gap_note && ['forward','reverse'].every(dir=>gap.access[dir].status==='unknown' && gap.access[dir].reason.includes(evidence.gap_note)) && endpointGaps.length>0 && endpointGaps.every(e=>!e.evidence_ids?.includes(evidence.id) && !urls.some(url=>e.evidence_urls.includes(url))), 'Ward gate context applies to the scoped unmatched segment only; it does not establish car permission or a current closure.',urls);
}
const ardmore=data.routes.find(r=>r.name==='Ardmore');
if (ardmore) {
  const city=cityRecord('row-39t4_437d.zgtb'), east=cityRecord('row-bnei~wvhc.jrsx'), trail=getWay.get(26237577), road=getWay.get(30679340);
  const tt=trail && JSON.parse(trail.tags), rt=road && JSON.parse(road.tags), roadEdges=ardmore.edges.filter(e=>e.way_id===30679340), gap=ardmore.edges.at(-1);
  check('ardmore-lakefront-source',true,!!east && tt?.highway==='cycleway' && tt?.name==='Lakefront Trail' && !!gap && gap.role==='gap' && gap.length_m>50 && gap.access.forward.status==='unknown' && gap.access.reverse.status==='unknown' && metres(gap.geometry.coordinates.at(-1),east.the_geom.coordinates[0][0])<1,'The city designation reaches the lakefront; the staged cycleway is not evidence of a general car connection.',[sourceUrl,'https://www.openstreetmap.org/way/26237577']);
  check('ardmore-contraflow-source',true,city?.br_oneway==='2W' && city?.contraflow==='Y' && city?.oneway_dir==='E' && rt?.oneway==='yes' && rt?.['oneway:bicycle']==='no','City and OSM record bicycle contraflow alongside eastbound motor direction.',[sourceUrl,'https://www.openstreetmap.org/way/30679340']);
  check('ardmore-contraflow-motor',true,roadEdges.length>0 && roadEdges.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked'),'The bicycle exception does not authorize westbound motor travel.', ['https://www.openstreetmap.org/way/30679340']);
}
const school=data.routes.find(r=>r.name==='School');
if (school) {
  const ids=['row-ensn~hrye.ce4y','row-h7za.495h_8e9t'];
  check('school-city-direction',true,ids.every(id=>cityRecord(id)?.oneway_dir==='E') && ids.every(id=>school.source_ids.includes(id)),'Both city designation records state eastbound motor direction.',[sourceUrl]);
  for (const id of [619457514,619457512,1265277206,185352303]) {
    const w=getWay.get(id), t=w && JSON.parse(w.tags), edges=school.edges.filter(e=>e.way_id===id);
    check(`school-${id}-westbound-conflict`,true,!!t && t.highway==='residential' && t.oneway==null && edges.length>0 && edges.every(e=>e.access.reverse.status==='unknown' && e.access.reverse.evidence_status==='conflicting'),'The snapshot lacks a motor one-way tag while the city asserts eastbound; westbound requires review.',[sourceUrl,`https://www.openstreetmap.org/way/${id}`]);
  }
}
// The named Glenwood jogs are checked against city geometry and staged OSM,
// not merely against the configured export. No neighboring Glenwood slice is admitted.
const nodeCoords = db.prepare('SELECT lon,lat,tags FROM nodes WHERE id=?');
for (const [routeId,wayId,cityId,expectedNodes] of [
  ['winnemac-2',992031721,'row-muht_4bn5-v2q2',[257156331,11153435102,257154871]],
  ['carmen-2',23744939,'row-567r_3xw8.pymc',[257156232,11352634295,257155045]],
]) {
  const route=data.routes.find(r=>r.id===routeId), way=getWay.get(wayId), city=cityRecord(cityId);
  const nodes=way ? JSON.parse(way.nodes) : [], tags=way ? JSON.parse(way.tags) : {}, i=nodes.indexOf(expectedNodes[0]);
  const coords=expectedNodes.map(n=>nodeCoords.get(n));
  const cityLines=city?.the_geom?.coordinates ?? [];
  let within=coords.every(Boolean) && cityLines.length>0;
  if (within) for (let j=1;j<coords.length;j++) {
    const a=coords[j-1], b=coords[j], steps=Math.ceil(metres([a.lon,a.lat],[b.lon,b.lat]));
    for (let k=0;k<=steps;k++) {
      const p=[a.lon+(b.lon-a.lon)*k/steps,a.lat+(b.lat-a.lat)*k/steps];
      if (Math.min(...cityLines.map(line=>locate(p,line).distance))>5) within=false;
    }
  }
  const edges=route?.edges.filter(e=>e.way_id===wayId) ?? [];
  const path=edges.length===expectedNodes.length-1 && edges.every((e,j)=>e.from_node===expectedNodes[j] && e.to_node===expectedNodes[j+1]);
  const edgeGeometry=edges.every((e,j)=>e.geometry.coordinates.length===2 && coords[j] && coords[j+1] && metres(e.geometry.coordinates[0],[coords[j].lon,coords[j].lat])<0.1 && metres(e.geometry.coordinates[1],[coords[j+1].lon,coords[j+1].lat])<0.1);
  const provenance=edges.every(e=>e.matching?.method==='explicit-city-geometry-way-slice' && e.matching.evidence_status==='source-inferred' && JSON.stringify(e.matching.city_source_ids)==JSON.stringify([cityId]));
  check(`${routeId}-glenwood-source-and-slice`,true,!!route && route.source_ids.includes(cityId) && city?.oneway_dir==='-' && i>=0 && expectedNodes.every((n,j)=>nodes[i+j]===n) && within && path && edgeGeometry && provenance,'Contiguous staged way slice, all its segments within five metres of the bound city record, with both ends attached and no extra part of the cross street exported.',[sourceUrl,`https://www.openstreetmap.org/way/${wayId}`]);
  const hasOtherRestrictions=expectedNodes.some(n=>viaNodes.has(n) || relevantNode(JSON.parse(nodeCoords.get(n)?.tags ?? '{}'))) || wayRestrictions.has(wayId) || Object.keys(tags).some(k=>k.includes('conditional'));
  const movementList=route?.movements.filter(m=>edges.some(e=>m.from_edge===e.id || m.to_edge===e.id)) ?? [];
  check(`${routeId}-glenwood-access-and-turns`,true,tags.highway==='residential' && !tags.oneway && !hasOtherRestrictions && edges.length===2 && edges.every(e=>['forward','reverse'].every(d=>e.access[d].status==='allowed' && e.access[d].evidence_status==='source-inferred')) && movementList.length===3 && movementList.every(m=>['forward','reverse'].every(d=>m[d].status==='allowed' && m[d].evidence_status==='source-inferred')),'Snapshot residential tags and absence of relevant restriction or node tags support these specific edge and turn inferences; present conditions remain unverified.',[`https://www.openstreetmap.org/way/${wayId}`]);
}
// Geographically separate city components must not become a through route.
for (const [label,ids] of [
 ['winnemac-park',['row-j7ru~242h_rfdy','row-xj27~69f9_ksrb']],
 ['ainslie-western-lincoln',['row-rtc4_mfqg~45k3','row-aguw~42z7~mmxa']],
]) {
  const records=ids.map(cityRecord), routes=ids.map(id=>data.routes.find(r=>r.source_ids.includes(id)));
  const endpoints=records.map(r=>{const line=r?.the_geom?.coordinates?.[0];return line ? [line[0],line.at(-1)] : [];});
  const distance=endpoints[0].length && endpoints[1].length ? Math.min(...endpoints[0].flatMap(a=>endpoints[1].map(b=>metres(a,b)))) : 0;
  check(`${label}-separate-designations`,true,records.every(Boolean) && distance>20 && routes.every(Boolean) && routes[0].id!==routes[1].id && routes.every(r=>!ids.every(id=>r.source_ids.includes(id))),'Independent city geometries have a gap; separate exported route components do not establish a joining motor movement.',[sourceUrl]);
}
for (const [routeId,cityId,wayId] of [['argyle-1','row-wkph~qm3w~5yab',1443715350],['argyle-2','row-nn2f.26nq.pskp',24078652]]) {
  const city=cityRecord(cityId), way=getWay.get(wayId), tags=way && JSON.parse(way.tags), nodes=way && JSON.parse(way.nodes), route=data.routes.find(r=>r.id===routeId), edges=route?.edges.filter(e=>e.way_id===wayId) ?? [];
  const first=nodes && nodeCoords.get(nodes[0]), last=nodes && nodeCoords.get(nodes.at(-1));
  check(`${routeId}-westbound-car-contraflow`,true,city?.oneway_dir==='W' && city?.contraflow==='Y' && tags?.oneway==='yes' && tags?.['oneway:bicycle']==='no' && !!first && !!last && last.lon<first.lon && edges.length>0 && edges.every(e=>e.access.forward.status==='blocked' && e.access.reverse.status==='allowed'),'City westbound direction and staged westbound OSM one-way agree; bicycle contraflow does not establish eastbound motor access.',[sourceUrl,`https://www.openstreetmap.org/way/${wayId}`]);
}
{
 const city=cityRecord('row-rfjh_buwp~qfix'), w=getWay.get(1257543990), tags=w && JSON.parse(w.tags), route=data.routes.find(r=>r.id==='carmen-1'), edges=route?.edges.filter(e=>e.way_id===1257543990) ?? [];
 check('carmen-kedzie-albany-conflict',true,city?.oneway_dir==='E' && city?.br_oneway==='1W' && tags?.highway==='residential' && !tags.oneway && edges.length>0 && edges.every(e=>e.access.reverse.status==='unknown' && e.access.reverse.evidence_status==='conflicting'),'City says eastbound one-way while the staged OSM way lacks a motor one-way tag; preserve the westbound conflict.',[sourceUrl,'https://www.openstreetmap.org/way/1257543990']);
}
{
 const evidenceFile=JSON.parse(await readFile('data/routes/review-evidence.json','utf8'));
 const evidence=evidenceFile.records.find(r=>r.id==='ainslie-western-left-turn');
 const city=cityRecord('row-aguw~42z7~mmxa'), route=data.routes.find(r=>r.id==='ainslie-2'), edge=route?.edges[0], node=nodeCoords.get(293816189);
 const terminal=route?.runs.flatMap(run=>[run.start,run.end]).filter(end=>end.coordinate && node && metres(end.coordinate,[node.lon,node.lat])<2) ?? [];
 const sourceRestriction=restrictions.filter(r=>r.members.some(m=>m.role==='via' && m.type==='node' && m.ref===293816189));
 const urls=evidence?.sources?.map(s=>s.url) ?? [];
 check('ainslie-western-left-turn-not-through-block',true,!!evidence && /left turn/i.test(evidence.movement) && evidence.source_record_ids?.includes(city?.[':id']) && urls.length>=2 && !!node && city?.the_geom.coordinates[0].some(p=>metres(p,[node.lon,node.lat])<2) && edge?.from_node===293816189 && edge.access.reverse.status==='allowed' && terminal.length===2 && terminal.every(end=>end.kind==='unknown') && !sourceRestriction.some(r=>/straight/i.test(r.tags.restriction ?? '')),'The cited left-turn proposal and reported signs concern a turn; the separately scoped through crossing is unknown, not a blanket straight-through block. Staged node restrictions and the city endpoint are checked independently.',[sourceUrl,`https://www.openstreetmap.org/node/293816189`,...urls]);
}
// Narrow snapshot checks; none establish a field approval.
{
 const ids=['row-y2dq.3s9k_38gf','row-vhym~pu4g.guju'], rows=ids.map(cityRecord), routes=data.routes.filter(r=>r.name==='Aldine');
 const ends=rows.map(r=>{const line=r?.the_geom.coordinates[0];return line ? [line[0],line.at(-1)] : [];});
 const distance=ends.every(x=>x.length) ? Math.min(...ends[0].flatMap(a=>ends[1].map(b=>metres(a,b)))) : 0;
 const connector=routes.flatMap(r=>r.edges).filter(e=>e.role!=='designated' && e.geometry.coordinates.some(p=>metres(p,[-87.64446,41.94204])<30));
 const terminals=routes.flatMap(r=>r.runs.flatMap(run=>[run.start,run.end])).filter(e=>e.coordinate && metres(e.coordinate,[-87.64446,41.94204])<30);
 check('aldine-broadway-offset-unresolved',true,rows.every(Boolean) && distance>35 && ids.every(id=>routes.some(r=>r.source_ids.includes(id))) && (connector.length ? connector.every(e=>['forward','reverse'].every(d=>e.access[d].status==='unknown')) : terminals.length>=2 && terminals.every(e=>e.kind==='unknown')),'City lines are offset at Broadway; the intervening motor connection and turns remain unknown.',[sourceUrl]);
 for (const [cityId,wayId] of [['row-y2dq.3s9k_38gf',24117483],['row-vhym~pu4g.guju',24117482]]) {
  const city=cityRecord(cityId), way=getWay.get(wayId), tags=way && JSON.parse(way.tags), nodes=way && JSON.parse(way.nodes), first=nodes && nodeCoords.get(nodes[0]), last=nodes && nodeCoords.get(nodes.at(-1));
  const edges=routes.flatMap(r=>r.edges.filter(e=>e.way_id===wayId));
  check(`aldine-${wayId}-eastbound`,true,city?.oneway_dir==='E' && tags?.oneway==='yes' && !!first && !!last && last.lon>first.lon && edges.length>0 && edges.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked'),'City and staged OSM agree on this eastbound segment; current signs and Broadway turns remain unverified.',[sourceUrl,`https://www.openstreetmap.org/way/${wayId}`]);
 }
}
{
 const ids=['row-kb56.czy3-uyw7','row-hkyx_48ex_8z98'], routes=data.routes.filter(r=>r.name==='Cortland'), way=getWay.get(1425934580), tags=way && JSON.parse(way.tags), edges=routes.flatMap(r=>r.edges.filter(e=>e.way_id===1425934580));
 check('cortland-source-scope',true,ids.every(id=>routes.some(r=>r.source_ids.includes(id))) && ids.every(id=>cityRecord(id)?.br_oneway==='2W') && tags?.highway==='residential' && !tags.oneway && edges.length>0 && edges.every(e=>['forward','reverse'].every(d=>e.access[d].status==='allowed' && e.access[d].evidence_status==='source-inferred')),'Two distinct city rows describe two-way bicycle facilities; this residential snapshot way lacks a motor one-way tag. Other junctions and current signs remain unverified.',[sourceUrl,'https://www.openstreetmap.org/way/1425934580']);
 const rows=ids.map(cityRecord), components=ids.map(id=>routes.find(r=>r.source_ids.includes(id)));
 const endpoints=rows.map(r=>{const line=r?.the_geom.coordinates[0];return line ? [line[0],line.at(-1)] : [];});
 const separation=endpoints.every(e=>e.length) ? Math.min(...endpoints[0].flatMap(a=>endpoints[1].map(b=>metres(a,b)))) : 0;
 check('cortland-separate-city-components',true,rows.every(Boolean) && separation>20 && components.every(Boolean) && components[0].id!==components[1].id && components.every(r=>!ids.every(id=>r.source_ids.includes(id))),'Distant city designations remain separate exports; a street name alone does not establish a through connection.',[sourceUrl]);
 const gaps=routes.flatMap(r=>r.edges.filter(e=>e.role==='gap'));
 check('cortland-unmatched-edges-unknown',true,gaps.length>0 && gaps.every(e=>['forward','reverse'].every(d=>e.access[d].status==='unknown')),'Unmatched designation edges remain unresolved in both directions.',[sourceUrl]);
}
{
 const ids=['row-z2zq.9rfs-98dq','row-98r2~7mff~uhez','row-sr4p.w5e8.ucbq','row-rg87.cynd-7yib','row-7n7e-y6xv.3ipe','row-g87j-tbmk_gx4c','row-kxgt~6ijf-duva'], routes=data.routes.filter(r=>r.name==='Berwyn');
 const alias=cityRecord(ids[0]), way=getWay.get(155342641), tags=way && JSON.parse(way.tags), edges=routes.flatMap(r=>r.edges.filter(e=>e.way_id===155342641));
 check('berwyn-berwn-source-coverage',true,ids.every(id=>routes.some(r=>r.source_ids.includes(id))) && alias?.st_name==='BERWN' && alias.oneway_dir==='W' && tags?.name==='West Berwyn Avenue' && tags.oneway==='yes' && tags['oneway:bicycle']==='no' && edges.length>0 && edges.every(e=>e.access.forward.status==='blocked' && e.access.reverse.status==='allowed'),'Retain the misspelled BERWN city row using its geometry and staged Berwyn road; bicycle contraflow is not motor access.',[sourceUrl,'https://www.openstreetmap.org/way/155342641']);
 const ew=getWay.get(23743973), et=ew && JSON.parse(ew.tags), east=routes.flatMap(r=>r.edges.filter(e=>e.way_id===23743973));
 check('berwyn-winthrop-sheridan-eastbound',true,cityRecord('row-g87j-tbmk_gx4c')?.oneway_dir==='E' && et?.oneway==='yes' && et['oneway:bicycle']==='no' && east.length>0 && east.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='blocked'),'City and OSM indicate eastbound motor travel on this segment with bicycle contraflow.',[sourceUrl,'https://www.openstreetmap.org/way/23743973']);
 const path=getWay.get(26447429), pt=path && JSON.parse(path.tags), pn=path && JSON.parse(path.nodes), road=getWay.get(23741249), rn=road && JSON.parse(road.nodes), route=routes.find(r=>r.source_ids.includes('row-kxgt~6ijf-duva')), gap=route?.edges.find(e=>e.role==='gap');
 check('berwyn-lakefront-cycleway-not-car-connection',true,pt?.highway==='cycleway' && pt.bicycle==='designated' && pn?.some(n=>rn?.includes(n)) && !!gap && ['forward','reverse'].every(d=>gap.access[d].status==='unknown') && !routes.some(r=>r.edges.some(e=>e.way_id===26447429)),'The staged cycleway meets the road but does not establish an ordinary car connection; the unmatched endpoint remains unknown.',[sourceUrl,'https://www.openstreetmap.org/way/23741249','https://www.openstreetmap.org/way/26447429']);
}
{
 const ids=['row-ff46-gssy-rrp2','row-5t4c-tisg-vua6','row-hq5n~g4nt_de2u','row-4832.xuwa~f7zh'], routes=data.routes.filter(r=>r.name==='Polk'), w=getWay.get(582894470), tags=w && JSON.parse(w.tags), nodes=w && JSON.parse(w.nodes), first=nodes && nodeCoords.get(nodes[0]), last=nodes && nodeCoords.get(nodes.at(-1)), edges=routes.flatMap(r=>r.edges.filter(e=>e.way_id===582894470));
 check('polk-pulaski-independence-westbound',true,ids.every(id=>routes.some(r=>r.source_ids.includes(id))) && cityRecord(ids[0])?.oneway_dir==='W' && tags?.oneway==='yes' && tags['oneway:bicycle']==='no' && !!first && !!last && last.lon<first.lon && edges.length>0 && edges.every(e=>e.access.forward.status==='blocked' && e.access.reverse.status==='allowed'),'City and OSM indicate westbound motor travel with bicycle contraflow; junctions and current signs remain unverified.',[sourceUrl,'https://www.openstreetmap.org/way/582894470']);
 const conflict=routes.flatMap(r=>r.edges.filter(e=>e.way_id===1284871397));
 check('polk-independence-boundary-conflict',true,conflict.length>0 && conflict.every(e=>e.access.forward.status==='unknown' && e.access.forward.evidence_status==='conflicting'),'Preserve the conflict where an edge straddles city rows with differing direction assertions.',[sourceUrl,'https://www.openstreetmap.org/way/1284871397']);
}
const dbHash = createHash('sha256');
for await (const chunk of createReadStream(database)) dbHash.update(chunk);
const stagedDatabaseSha256 = dbHash.digest('hex');
const report = {schema_version:1,audited_at:new Date().toISOString(),input,input_sha256:createHash('sha256').update(bytes).digest('hex'),staged_database:database,staged_database_sha256:stagedDatabaseSha256,osm_source_sha256:data.source?.osm_sha256,osm_snapshot_date:data.source?.osm_date,designation_snapshot_date:data.source?.designation_date,purpose:'Source consistency checks and narrow movement samples; no field review, legal certification, or whole-corridor approval.',scope_caveat:'Samples test junction movement rules only; adjoining edges and current signs may differ.',sampling_method:'Two distinct eligible same-way nodes nearest route-index quartiles per route, both directions; selection independent of observed result. Unknown, restricted and junction-traversal nodes are excluded.',sample_count:samples.length,targeted_check_count:checks.length,field_approvals:0,samples,targeted_checks:checks,skips};
await writeFile(output, JSON.stringify(report,null,2)+'\n');
db.close();
const failures = [...samples,...checks].filter(x=>x.result==='fail').length;
console.log(JSON.stringify({input,output,sha256:report.input_sha256,routes:data.routes.length,samples:samples.length,failures,skips:skips.length}));
if (failures) process.exitCode = 1;
