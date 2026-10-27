/**
 * Isolated experiment: trace an already matched, ordered designated route.
 * This does not match streets or infer legality from OSM, names, or angles.
 * Every edge access and junction movement must explicitly describe THROUGH-CAR
 * permission in each direction: {status: 'allowed'|'blocked'|'unknown', reason}.
 * Destination-only access must therefore be supplied as blocked, with its reason.
 * Endpoint kinds are 'scope_end' (designation ends) or 'unknown' (incomplete route).
 */
const directions = ['forward', 'reverse'];
const statuses = new Set(['allowed', 'blocked', 'unknown']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function requireValue(condition, message) {
  if (!condition) throw new Error(`Invalid route: ${message}`);
}
function validateDecisions(pair, label) {
  for (const direction of directions) {
    const decision = pair?.[direction];
    requireValue(statuses.has(decision?.status) && nonempty(decision?.reason),
      `${label}.${direction} needs an explicit status and reason`);
  }
}
function validate(route) {
  requireValue(nonempty(route?.id), 'id is required');
  requireValue(route.profile === 'through_car', 'profile must be through_car');
  requireValue(Array.isArray(route.edges) && route.edges.length > 0, 'edges must be nonempty');
  const ids = new Set();
  for (const edge of route.edges) {
    requireValue(nonempty(edge?.id) && !ids.has(edge.id), 'edge ids must be unique');
    ids.add(edge.id);
    requireValue(Number.isFinite(edge.length_m) && edge.length_m > 0, 'edge lengths must be positive finite metres');
    validateDecisions(edge.access, `edge ${edge.id}`);
  }
  requireValue(Number.isFinite(route.edges.reduce((sum, edge) => sum + edge.length_m, 0)), 'total length overflows');
  requireValue(Array.isArray(route.movements) && route.movements.length === route.edges.length - 1,
    'one movement pair is required between each adjacent edge pair');
  ids.clear();
  for (const movement of route.movements) {
    requireValue(nonempty(movement?.id) && !ids.has(movement.id), 'movement ids must be unique');
    ids.add(movement.id);
    validateDecisions(movement, `movement ${movement.id}`);
  }
  for (const side of ['start', 'end']) {
    const endpoint = route.endpoints?.[side];
    requireValue(['scope_end', 'unknown'].includes(endpoint?.kind) && nonempty(endpoint?.reason),
      `${side} endpoint needs an explicit kind and reason`);
  }
}

export function traceRoute(route) {
  validate(route);
  const runs = [], excluded = [];
  for (const direction of directions) {
    const indices = route.edges.map((_, index) => index);
    if (direction === 'reverse') indices.reverse();
    const edges = indices.map(index => route.edges[index]);
    const boundary = position => {
      if (position === 0) return { ...route.endpoints[direction === 'forward' ? 'start' : 'end'] };
      if (position === edges.length) return { ...route.endpoints[direction === 'forward' ? 'end' : 'start'] };
      const movement = route.movements[Math.min(indices[position - 1], indices[position])];
      const decisions = [
        { ...edges[position - 1].access[direction], source: `edge:${edges[position - 1].id}` },
        { ...movement[direction], source: `movement:${movement.id}` },
        { ...edges[position].access[direction], source: `edge:${edges[position].id}` },
      ];
      // A known prohibition suffices even if another fact at this boundary is unknown.
      const kind = decisions.some(item => item.status === 'blocked') ? 'blocked' : 'unknown';
      const reasons = decisions.filter(item => item.status === kind);
      if (reasons.length === 0) return null;
      return { kind, reason: reasons.map(item => item.reason).join('; '), sources: reasons.map(item => item.source) };
    };
    let position = 0;
    while (position < edges.length) {
      if (edges[position].access[direction].status !== 'allowed') {
        excluded.push({ edge_id: edges[position].id, direction, ...edges[position].access[direction] });
        position++;
        continue;
      }
      const start = position, edgeIds = [], startBoundary = boundary(start);
      let length = 0;
      do {
        edgeIds.push(edges[position].id);
        length += edges[position].length_m;
        position++;
      } while (position < edges.length && boundary(position) === null);
      const endBoundary = boundary(position);
      runs.push({
        direction, edge_ids: edgeIds, length_m: length,
        start: startBoundary, end: endBoundary,
        complete_within_route: startBoundary.kind !== 'unknown' && endBoundary.kind !== 'unknown',
        scope_limited: startBoundary.kind === 'scope_end' || endBoundary.kind === 'scope_end',
      });
    }
  }
  return { route_id: route.id, profile: route.profile, runs, excluded };
}
