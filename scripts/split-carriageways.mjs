import { locate, metres } from './route-network.mjs';
import { edgeAccess } from './motor-rules.mjs';

const motorHighways = new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service']);

/** Prepare an explicitly evidenced, bounded pair of opposite carriageways. */
export function addSplitCarriageway({ graph, ways, binding, cityRecords, componentIds, evidenceRecords, incidentWays }) {
  const fail = reason => { throw new Error(`Split carriageway: ${reason}`); };
  const ids = binding?.way_ids, cityIds = binding?.city_source_ids;
  if (!(graph instanceof Map) || !Array.isArray(ways) || !Array.isArray(incidentWays)) fail('graph, ways and complete incident way inventory required');
  if (!Array.isArray(ids) || ids.length < 2 || new Set(ids).size !== ids.length) fail('distinct way IDs required');
  const arms = binding.arms ?? (ids.length === 2 ? [[ids[0]], [ids[1]]] : null);
  if (!Array.isArray(arms) || arms.length !== 2 || arms.some(arm => !Array.isArray(arm) || !arm.length) || arms.flat().length !== ids.length || new Set(arms.flat()).size !== ids.length || arms.flat().some(id => !ids.includes(id))) fail('two arms must partition way IDs');
  if (!Array.isArray(cityIds) || !cityIds.length || new Set(cityIds).size !== cityIds.length || !Array.isArray(componentIds) || cityIds.some(id => !componentIds.includes(id))) fail('bound city sources must belong to component');
  const records = cityIds.map(id => cityRecords?.find(r => r[':id'] === id));
  if (records.some(r => r?.the_geom?.type !== 'MultiLineString' || !r.the_geom.coordinates?.length || r.the_geom.coordinates.some(line => !Array.isArray(line) || line.length < 2 || line.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n)))))) fail('city geometry missing');
  const evidence = evidenceRecords?.find(r => r.id === binding.evidence_id);
  if (!binding.evidence_id || !evidence || ids.some(id => !evidence.way_ids?.includes(id)) || cityIds.some(id => !evidence.source_record_ids?.includes(id))) fail('evidence must bind both ways and all city sources');
  if (ids.some(id => ways.filter(w => w.id === id).length !== 1)) fail('each bound way must occur exactly once');
  const pair = ids.map(id => ways.find(w => w.id === id));
  if (pair.some(w => !w || !motorHighways.has(w.tags?.highway) || typeof w.tags.name !== 'string' || !w.tags.name.trim() || w.tags.oneway !== 'yes')) fail('two named one-way motor roads required');
  if (pair.some(w => w.tags.name !== pair[0].tags.name)) fail('way names differ');
  for (const way of pair) {
    if (!Array.isArray(way.nodes) || way.nodes.length < 2 || new Set(way.nodes).size !== way.nodes.length || !Array.isArray(way.coordinates) || way.coordinates.length !== way.nodes.length || !Array.isArray(way.nodeTags) || way.nodeTags.length !== way.nodes.length || way.coordinates.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n)))) fail('invalid way nodes or geometry');
  }
  const byId = new Map(pair.map(way => [way.id, way]));
  const chains = arms.map(arm => {
    const chain = arm.map(id => byId.get(id));
    const nodes = [];
    for (const [i, way] of chain.entries()) {
      if (i && (chain[i-1].nodes.at(-1) !== way.nodes[0] || metres(chain[i-1].coordinates.at(-1), way.coordinates[0]) > 0.01)) fail('arm ways must join in source order');
      nodes.push(...(i ? way.nodes.slice(1) : way.nodes));
    }
    if (new Set(nodes).size !== nodes.length) fail('arm nodes must be unique');
    return {chain, nodes};
  });
  const [a,b] = chains;
  if (a.nodes[0] !== b.nodes.at(-1) || a.nodes.at(-1) !== b.nodes[0]) fail('arms must share opposite endpoints');
  if (a.nodes.slice(1,-1).some(n => b.nodes.includes(n)) || b.nodes.slice(1,-1).some(n => a.nodes.includes(n))) fail('interior nodes must be disjoint');
  if (metres(a.chain[0].coordinates[0],b.chain.at(-1).coordinates.at(-1)) > 0.01 || metres(a.chain.at(-1).coordinates.at(-1),b.chain[0].coordinates[0]) > 0.01) fail('shared node coordinates disagree');
  const interior = [...a.nodes.slice(1,-1),...b.nodes.slice(1,-1)];
  const reviewed = binding.reviewed_branches ?? [];
  if (!Array.isArray(reviewed) || new Set(reviewed.map(r => r.node_id)).size !== reviewed.length) fail('invalid reviewed branches');
  const isMotor = w => motorHighways.has(w.tags?.highway) || (w.tags?.highway && Object.values(edgeAccess(w.tags)).some(x => x.status !== 'blocked'));
  for (const review of reviewed) {
    if (!interior.includes(review.node_id) || !Array.isArray(review.way_ids) || !review.way_ids.length || new Set(review.way_ids).size !== review.way_ids.length || review.way_ids.some(id => ids.includes(id))) fail('invalid reviewed branch binding');
    const observed = new Set(incidentWays.filter(w => !ids.includes(w.id) && w.nodes?.includes(review.node_id) && isMotor(w)).map(w => w.id));
    if (observed.size !== review.way_ids.length || review.way_ids.some(id => !observed.has(id))) fail('reviewed branches must match exact observed set');
    const proof = evidenceRecords?.find(r => r.id === review.evidence_id);
    if (!review.evidence_id || !proof || [...ids,...review.way_ids].some(id => !proof.way_ids?.includes(id)) || cityIds.some(id => !proof.source_record_ids?.includes(id))) fail('branch evidence must bind group, branch and city sources');
  }
  for (const node of interior) {
    if (incidentWays.some(w => !ids.includes(w.id) && w.nodes?.includes(node) && isMotor(w)) && !reviewed.some(r => r.node_id === node)) fail('extra motor highway at interior node');
  }
  const branchIds = new Set(reviewed.flatMap(r => r.way_ids));
  for (const node of [a.nodes[0], a.nodes.at(-1)]) {
    if (!(graph.get(node) ?? []).some(e => !ids.includes(e.way?.id) && !branchIds.has(e.way?.id) && motorHighways.has(e.way?.tags?.highway))) fail('both endpoints require existing nonpair motor road attachment');
  }
  const lines = records.flatMap(r => r.the_geom.coordinates);
  let total = 0;
  for (const way of pair) for (let i=1;i<way.nodes.length;i++) {
    const p=way.coordinates[i-1], q=way.coordinates[i], length=metres(p,q);
    if (!Number.isFinite(length) || length <= 0) fail('invalid zero-length segment');
    total += length;
    const steps=Math.ceil(length);
    for (let j=0;j<=steps;j++) {
      const point=[p[0]+(q[0]-p[0])*j/steps,p[1]+(q[1]-p[1])*j/steps];
      if (Math.min(...lines.map(line => locate(point,line).distance)) > 8) fail('way departs from bound city geometry');
    }
  }
  if (total > 250) fail('combined length exceeds 250 metres');
  // Exclude reviewed branches already present in the aligned graph, after all checks.
  for (const [node, edges] of graph) {
    const kept = edges.filter(edge => !branchIds.has(edge.way?.id));
    if (kept.length) graph.set(node, kept);
    else graph.delete(node);
  }
  const group=pair.map(way => ({...way, split_match:{method:'explicit-city-split-carriageway',city_source_ids:cityIds.slice(),evidence_id:binding.evidence_id}}));
  for (const way of group) for (let i=1;i<way.nodes.length;i++) {
    const from=way.nodes[i-1], to=way.nodes[i], length=metres(way.coordinates[i-1],way.coordinates[i]);
    for (const edge of [{from,to,reversed:false},{from:to,to:from,reversed:true}]) {
      if (!graph.has(edge.from)) graph.set(edge.from,[]);
      if (!graph.get(edge.from).some(e => e.way?.id===way.id && e.index===i-1 && e.to===edge.to && e.reversed===edge.reversed)) graph.get(edge.from).push({...edge,way,index:i-1,length});
    }
  }
  return group;
}
