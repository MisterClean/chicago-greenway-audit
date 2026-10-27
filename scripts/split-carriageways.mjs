import { locate, metres } from './route-network.mjs';
import { edgeAccess } from './motor-rules.mjs';

const motorHighways = new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service']);

/** Prepare an explicitly evidenced, bounded pair of opposite carriageways. */
export function addSplitCarriageway({ graph, ways, binding, cityRecords, componentIds, evidenceRecords, incidentWays }) {
  const fail = reason => { throw new Error(`Split carriageway: ${reason}`); };
  const ids = binding?.way_ids, cityIds = binding?.city_source_ids;
  if (!(graph instanceof Map) || !Array.isArray(ways) || !Array.isArray(incidentWays)) fail('graph, ways and complete incident way inventory required');
  if (!Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2) fail('exactly two distinct way IDs required');
  if (!Array.isArray(cityIds) || !cityIds.length || new Set(cityIds).size !== cityIds.length || !Array.isArray(componentIds) || cityIds.some(id => !componentIds.includes(id))) fail('bound city sources must belong to component');
  const records = cityIds.map(id => cityRecords?.find(r => r[':id'] === id));
  if (records.some(r => r?.the_geom?.type !== 'MultiLineString' || !r.the_geom.coordinates?.length || r.the_geom.coordinates.some(line => !Array.isArray(line) || line.length < 2 || line.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n)))))) fail('city geometry missing');
  const evidence = evidenceRecords?.find(r => r.id === binding.evidence_id);
  if (!binding.evidence_id || !evidence || ids.some(id => !evidence.way_ids?.includes(id)) || cityIds.some(id => !evidence.source_record_ids?.includes(id))) fail('evidence must bind both ways and all city sources');
  const pair = ids.map(id => ways.find(w => w.id === id));
  if (pair.some(w => !w || !motorHighways.has(w.tags?.highway) || typeof w.tags.name !== 'string' || !w.tags.name.trim() || w.tags.oneway !== 'yes')) fail('two named one-way motor roads required');
  if (pair[0].tags.name !== pair[1].tags.name) fail('way names differ');
  for (const way of pair) {
    if (!Array.isArray(way.nodes) || way.nodes.length < 2 || new Set(way.nodes).size !== way.nodes.length || !Array.isArray(way.coordinates) || way.coordinates.length !== way.nodes.length || !Array.isArray(way.nodeTags) || way.nodeTags.length !== way.nodes.length || way.coordinates.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n)))) fail('invalid way nodes or geometry');
  }
  const [a,b] = pair;
  if (a.nodes[0] !== b.nodes.at(-1) || a.nodes.at(-1) !== b.nodes[0]) fail('ways must share opposite endpoints');
  if (a.nodes.slice(1,-1).some(n => b.nodes.includes(n)) || b.nodes.slice(1,-1).some(n => a.nodes.includes(n))) fail('interior nodes must be disjoint');
  if (metres(a.coordinates[0],b.coordinates.at(-1)) > 0.01 || metres(a.coordinates.at(-1),b.coordinates[0]) > 0.01) fail('shared node coordinates disagree');
  for (const node of [a.nodes[0],a.nodes.at(-1)]) {
    if (!(graph.get(node) ?? []).some(e => !ids.includes(e.way?.id) && motorHighways.has(e.way?.tags?.highway))) fail('both endpoints require existing nonpair motor road attachment');
  }
  for (const node of [...a.nodes.slice(1,-1),...b.nodes.slice(1,-1)]) {
    if (incidentWays.some(w => !ids.includes(w.id) && w.nodes?.includes(node) && (motorHighways.has(w.tags?.highway) || (w.tags?.highway && Object.values(edgeAccess(w.tags)).some(x => x.status !== 'blocked'))))) fail('extra motor highway at interior node');
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
  if (total > 150) fail('combined length exceeds 150 metres');
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
