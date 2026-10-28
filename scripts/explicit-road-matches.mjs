const motorHighways = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service']);

/** Resolve reviewed city-to-road correspondences; geometry and access remain the caller's responsibility. */
export function resolveExplicitRoadMatches({ bindings, routeId, componentIds, evidenceRecords, ways }) {
  const fail = message => { throw new Error(`Explicit road match: ${message}`); };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const stringIds = (value, label) => {
    if (!Array.isArray(value) || !value.length || value.some(id => !text(id)) || new Set(value).size !== value.length) fail(`${label} must contain unique nonempty IDs`);
  };
  if (!text(routeId)) fail('routeId required');
  stringIds(componentIds, 'componentIds');
  if (!Array.isArray(bindings) || !Array.isArray(evidenceRecords) || !Array.isArray(ways)) fail('bindings, evidenceRecords and ways must be arrays');
  const selected = [];
  const seen = new Set();
  for (const binding of bindings) {
    if (!text(binding?.route_id)) fail('binding route_id required');
    if (binding.route_id !== routeId) continue;
    stringIds(binding.city_source_ids, 'city_source_ids');
    if (binding.city_source_ids.some(id => !componentIds.includes(id))) fail('city source outside route component');
    const ids = binding.way_ids;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) fail('way_ids must contain unique positive integers');
    if (!text(binding.evidence_id)) fail('evidence_id required');
    const evidence = evidenceRecords.filter(record => record?.id === binding.evidence_id);
    if (evidence.length !== 1) fail('evidence missing or duplicated');
    const record = evidence[0];
    if (!Array.isArray(record.source_record_ids) || binding.city_source_ids.some(id => !record.source_record_ids.includes(id)) || !Array.isArray(record.way_ids) || ids.some(id => !record.way_ids.includes(id))) fail('evidence must bind all city sources and ways');
    if (!text(record.source_inference) || !Array.isArray(record.sources) || !record.sources.some(source => text(source?.url))) fail('evidence requires an explanation and source URL');
    for (const id of ids) {
      if (seen.has(id)) fail(`way ${id} is bound more than once`);
      const matches = ways.filter(way => way?.id === id);
      if (matches.length !== 1) fail(`way ${id} missing or duplicated`);
      const way = matches[0];
      if (!motorHighways.has(way.tags?.highway)) fail(`way ${id} is not a motor highway`);
      if (!Array.isArray(way.nodes) || way.nodes.length < 2 || way.nodes.some(node => !Number.isSafeInteger(node) || node <= 0) || !Array.isArray(way.coordinates) || way.coordinates.length !== way.nodes.length || way.coordinates.some(p => !Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) fail(`way ${id} has invalid nodes or coordinates`);
      seen.add(id);
      selected.push({ ...way, explicit_match: { method: 'explicit-city-road-correspondence', city_source_ids: [...binding.city_source_ids], evidence_id: binding.evidence_id } });
    }
  }
  return selected;
}
