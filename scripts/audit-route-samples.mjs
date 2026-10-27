// Independent snapshot consistency checks, not field or legal validation.
// node scripts/audit-route-samples.mjs [input.json] [output.json] [network.sqlite]
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

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
const dbHash = createHash('sha256');
for await (const chunk of createReadStream(database)) dbHash.update(chunk);
const stagedDatabaseSha256 = dbHash.digest('hex');
const report = {schema_version:1,audited_at:new Date().toISOString(),input,input_sha256:createHash('sha256').update(bytes).digest('hex'),staged_database:database,staged_database_sha256:stagedDatabaseSha256,osm_source_sha256:data.source?.osm_sha256,osm_snapshot_date:data.source?.osm_date,designation_snapshot_date:data.source?.designation_date,purpose:'Source consistency checks and narrow movement samples; no field review, legal certification, or whole-corridor approval.',scope_caveat:'Samples test junction movement rules only; adjoining edges and current signs may differ.',sampling_method:'Two distinct eligible same-way nodes nearest route-index quartiles per route, both directions; selection independent of observed result. Unknown, restricted and junction-traversal nodes are excluded.',sample_count:samples.length,targeted_check_count:checks.length,field_approvals:0,samples,targeted_checks:checks,skips};
await writeFile(output, JSON.stringify(report,null,2)+'\n');
db.close();
console.log(JSON.stringify({input,output,sha256:report.input_sha256,routes:data.routes.length,samples:samples.length,failures:[...samples,...checks].filter(x=>x.result==='fail').length,skips:skips.length}));
