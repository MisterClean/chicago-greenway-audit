import { locate, metres } from './route-network.mjs';

/** Add only a configured, city-supported OSM way slice to an existing route graph. */
export function addScopedRouteWay({ graph, way, binding, cityRecords, componentIds, maxDistance = 5 }) {
  const fail = reason => { throw new Error(`Scoped way ${binding.way_id}: ${reason}`); };
  if (!way || way.id !== binding.way_id) fail('way missing or mismatched');
  if (!Array.isArray(binding.nodes) || binding.nodes.length < 2 || new Set(binding.nodes).size !== binding.nodes.length) fail('invalid node slice');
  if (!Array.isArray(binding.city_source_ids) || !binding.city_source_ids.length || binding.city_source_ids.some(id => !componentIds.includes(id))) fail('city source must belong to this component');
  const records = binding.city_source_ids.map(id => cityRecords.find(r => r[':id'] === id));
  if (records.some(r => !r || r.the_geom?.type !== 'MultiLineString' || !r.the_geom.coordinates?.length)) fail('city source geometry missing');
  if (records.some(r => ![null, undefined, '-', ''].includes(r.oneway_dir))) fail('directional city assertion needs explicit jog-axis handling');
  const start = way.nodes.indexOf(binding.nodes[0]);
  if (start < 0 || binding.nodes.some((id,i) => way.nodes[start+i] !== id)) fail('node slice is absent or not contiguous and ordered');
  if (!graph.has(binding.nodes[0]) || !graph.has(binding.nodes.at(-1))) fail('both slice endpoints must attach to the existing route graph');
  const coordinates = way.coordinates.slice(start, start + binding.nodes.length);
  const lines = records.flatMap(r => r.the_geom.coordinates);
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i-1], b = coordinates[i];
    if (!a || !b) fail('missing node coordinates');
    const length = metres(a,b);
    if (!length) fail('zero-length segment');
    // Sampling at intervals no greater than one metre checks the entire slice,
    // including bends and mid-segment deviations, rather than endpoints alone.
    const steps = Math.ceil(length);
    for (let j = 0; j <= steps; j++) {
      const p = [a[0] + (b[0]-a[0])*j/steps, a[1] + (b[1]-a[1])*j/steps];
      if (Math.min(...lines.map(line => locate(p,line).distance)) > maxDistance) fail('slice departs from bound city geometry');
    }
  }
  const scoped = { ...way, nodes: binding.nodes.slice(), coordinates, nodeTags: way.nodeTags.slice(start, start + binding.nodes.length), scoped_match: { method: 'explicit-city-geometry-way-slice', city_source_ids: binding.city_source_ids.slice(), evidence_status: 'source-inferred' } };
  const add = (node, edge) => { if (!graph.has(node)) graph.set(node, []); graph.get(node).push(edge); };
  for (let i = 1; i < scoped.nodes.length; i++) {
    const a = scoped.nodes[i-1], b = scoped.nodes[i], base = { way: scoped, index: i-1, length: metres(scoped.coordinates[i-1],scoped.coordinates[i]) };
    add(a,{...base,from:a,to:b,reversed:false});
    add(b,{...base,from:b,to:a,reversed:true});
  }
  return scoped;
}
