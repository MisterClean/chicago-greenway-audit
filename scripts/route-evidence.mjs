import { edgeAccess } from './motor-rules.mjs';
import { metres } from './route-network.mjs';

// Context explains an unmatched passage; it never supplies a motor permission.
export function gapReviewContext(records, routeId, sourceIds, coordinates) {
  return records.filter(record => {
    const scope = record.gap_scope;
    if (!scope || scope.route_id !== routeId || !record.gap_note || !coordinates.length) return false;
    if (!record.source_record_ids?.some(id => sourceIds.includes(id))) return false;
    const bounds = scope.bounds;
    if (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return false;
    const [[west,south],[east,north]] = bounds;
    return west < east && south < north && coordinates.every(([lon,lat]) => lon >= west && lon <= east && lat >= south && lat <= north);
  });
}

// A documented installed filter can rule out through passage even while the
// connecting geometry is unmatched. This never creates a traversable gap.
export function inferGapFilter({record,routeId,sourceIds,gap,before,after,cycleway,road,boundaryNode,connectionWays,incidentWays}) {
  const filter = record.gap_filter;
  if (!filter) return null;
  const fail = reason => { throw new Error(`Gap filter ${record.id}: ${reason}`); };
  if (gap.role !== 'gap' || !gapReviewContext([record],routeId,sourceIds,gap.geometry.coordinates).length) fail('outside bound gap scope');
  if (filter.basis !== 'reported-installed-filter' || typeof filter.reason !== 'string' || !filter.reason.trim()) fail('explicit installed-filter basis and reason required');
  if (!Array.isArray(filter.supporting_source_urls) || filter.supporting_source_urls.length < 2 || filter.supporting_source_urls.some(url=>!record.sources?.some(source=>source.url===url))) fail('supporting documents must be catalogued');
  const id = filter.boundary_node;
  const adjacent = before?.to_node === id ? before : after?.from_node === id ? after : null;
  if (!adjacent || adjacent.way_id !== filter.road_way_id || road?.id !== filter.road_way_id || ![road.nodes[0],road.nodes.at(-1)].includes(id)) fail('road endpoint must be an adjacent gap boundary');
  const endpoint = adjacent === before ? gap.geometry.coordinates[0] : gap.geometry.coordinates.at(-1);
  if (boundaryNode?.id !== id || boundaryNode.tags?.highway !== 'turning_circle' || metres(endpoint,boundaryNode.coordinate)>5) fail('mapped turning-circle endpoint must match the gap');
  if (cycleway?.id !== filter.cycleway_id || cycleway.tags?.highway !== 'cycleway' || ![cycleway.nodes[0],cycleway.nodes.at(-1)].includes(id)) fail('mapped cycleway must terminate at the same road node');
  const path=filter.connection_path;
  if (!before?.to_node || !after?.from_node || !Array.isArray(path) || !path.length || !Array.isArray(connectionWays)) fail('explicit connected passage required');
  let cursor=before.to_node;
  const [[west,south],[east,north]]=record.gap_scope.bounds;
  for(const segment of path) {
    const way=connectionWays.find(way=>way?.id===segment.way_id);
    if (!way || !Array.isArray(segment.nodes) || segment.nodes.length<2 || segment.nodes[0]!==cursor) fail('passage segments must join the two gap boundaries');
    const start=way.nodes.indexOf(segment.nodes[0]), step=way.nodes[start+1]===segment.nodes[1] ? 1 : -1;
    for(const [i,nodeId] of segment.nodes.entries()) {
      if (start<0 || way.nodes[start+step*i]!==nodeId) fail('passage slice must follow source node order');
      const point=way.coordinates?.[start+step*i];
      if (!point || point[0]<west || point[0]>east || point[1]<south || point[1]>north) fail('passage leaves documented filter scope');
    }
    cursor=segment.nodes.at(-1);
  }
  if (cursor!==after.from_node || !path.some(segment=>segment.way_id===cycleway.id && segment.nodes.includes(id))) fail('passage must cross the cycleway and reach the opposite gap boundary');
  if (!Array.isArray(incidentWays) || !incidentWays.some(way=>way.id===road.id) || !incidentWays.some(way=>way.id===cycleway.id)) fail('complete incident road inventory required');
  if (incidentWays.some(way=>way.id!==road.id && way.tags?.highway && Object.values(edgeAccess(way.tags)).some(access=>access.status!=='blocked'))) fail('another motor continuation is allowed or unresolved');
  const access = edgeAccess(cycleway.tags);
  if (['forward','reverse'].some(direction=>access[direction].status !== 'blocked' || access[direction].kind !== 'access')) fail('cycleway does not consistently exclude through cars');
  const decision = {status:'blocked',kind:'physical',reason:filter.reason,evidence_status:'source-inferred',evidence_ids:[record.id],source_ids:[...new Set([`way/${road.id}`,...path.map(segment=>`way/${segment.way_id}`),`node/${id}`])]};
  return {forward:{...decision},reverse:{...decision}};
}
