import { edgeAccess, movementAccess } from './motor-rules.mjs';
import { lineLength } from './route-network.mjs';

// A junction must be a single simple cycle of real OSM segments. Unknown and
// blocked geometries are display fallbacks, not approved traversals.
export function traceJunction({ way, ways = way ? [way] : [], fromNode, toNode, fromWayId, toWayId, relations = [] }) {
  if (!ways.length || fromNode == null || toNode == null || fromNode === toNode || fromWayId == null || toWayId == null) return null;
  const graph = new Map(), positions = new Map(), seenEdges = new Set();
  const add = (id, edge) => { if (!graph.has(id)) graph.set(id, []); graph.get(id).push(edge); };
  for (const w of ways) {
    if (w.id == null || !['roundabout', 'circular'].includes(w.tags?.junction) || !Array.isArray(w.nodes) || !Array.isArray(w.coordinates) || w.nodes.length < 2 || w.nodes.length !== w.coordinates.length) return null;
    for (let i = 0; i < w.nodes.length; i++) {
      const p = w.coordinates[i];
      if (!Array.isArray(p) || p.length < 2 || !p.slice(0, 2).every(Number.isFinite)) return null;
      const prior = positions.get(w.nodes[i]);
      if (prior && (prior[0] !== p[0] || prior[1] !== p[1])) return null;
      positions.set(w.nodes[i], p);
      if (!i) continue;
      const a = w.nodes[i - 1], b = w.nodes[i], key = [String(a), String(b)].sort().join('|');
      if (a === b || seenEdges.has(key)) return null;
      seenEdges.add(key);
      add(a, { from: a, to: b, way: w, index: i - 1, reversed: false });
      add(b, { from: b, to: a, way: w, index: i - 1, reversed: true });
    }
  }
  if (!graph.has(fromNode) || !graph.has(toNode) || [...graph.values()].some(edges => edges.length !== 2)) return null;
  const visited = new Set(), stack = [fromNode];
  while (stack.length) { const n = stack.pop(); if (visited.has(n)) continue; visited.add(n); for (const e of graph.get(n)) stack.push(e.to); }
  if (visited.size !== graph.size || graph.size < 3) return null;
  const total = [...graph.entries()].reduce((n, [id, edges]) => n + edges.reduce((s, e) => s + lineLength([positions.get(id), positions.get(e.to)]), 0), 0) / 2;
  if (total > 200) return null;
  const arc = (start, end, first, incoming, outgoing) => {
    const edges = []; let current = first;
    while (true) {
      edges.push(current);
      if (current.to === end) break;
      current = graph.get(current.to).find(e => e.to !== current.from);
      if (!current || edges.length > graph.size) return null;
    }
    const coords = [positions.get(start), ...edges.map(e => positions.get(e.to))];
    const ids = [...new Set(edges.map(e => e.way.id))];
    const rules = edges.map(e => edgeAccess(e.way.tags, { reversed: e.reversed }).forward);
    const nodeTags = (e, node) => {
      const index = e.way.nodes.indexOf(node);
      return e.way.nodeTags?.[index] ?? {};
    };
    const firstEdge = edges[0], lastEdge = edges.at(-1);
    const entry = movementAccess({ fromWayId: incoming, toWayId: firstEdge.way.id, viaNodeId: start, viaNodeTags: nodeTags(firstEdge, start), relations, isUTurn: false });
    const exit = movementAccess({ fromWayId: lastEdge.way.id, toWayId: outgoing, viaNodeId: end, viaNodeTags: nodeTags(lastEdge, end), relations, isUTurn: false });
    const internal = edges.slice(1).map((e, i) => {
      const previous = edges[i], node = e.from;
      const r = movementAccess({ fromWayId: previous.way.id, toWayId: e.way.id, viaNodeId: node, viaNodeTags: nodeTags(previous, node), relations, isUTurn: false });
      return r.status === 'allowed' ? r : { ...r, status: 'unknown', kind: 'unknown', reason: `Interior movement needs junction arc splitting: ${r.reason}` };
    });
    const all = [...rules, entry, exit, ...internal];
    const chosen = all.find(r => r.status === 'blocked') ?? all.find(r => r.status === 'unknown') ?? all[0];
    const evidence = [...new Set([...ids.map(id => `way/${id}`), ...all.flatMap(r => r.source_ids ?? [])])];
    return { geometry: { type: 'LineString', coordinates: coords }, length_m: lineLength(coords), entry_way_id: firstEdge.way.id, exit_way_id: lastEdge.way.id, source_way_ids: ids, access: { ...chosen, source_ids: evidence }, _soleDirection: all.every(r => r.status === 'allowed' || (r.status === 'blocked' && r.kind === 'direction' && /oneway/i.test(r.reason))) };
  };
  const incoherentCirculation = start => graph.get(start).every(first => {
    let current = first, count = 0, blocked = false;
    do {
      const rule = edgeAccess(current.way.tags, { reversed: current.reversed }).forward;
      if (rule.status === 'blocked' && rule.kind === 'direction' && /oneway/i.test(rule.reason)) blocked = true;
      const next = graph.get(current.to).find(e => e.to !== current.from);
      current = next; count++;
    } while (current && current.from !== start && count <= graph.size);
    return blocked;
  });
  const direction = (start, end, incoming, outgoing) => {
    const arcs = graph.get(start).map(e => arc(start, end, e, incoming, outgoing));
    if (arcs.some(a => !a)) return null;
    const shortest = list => [...list].sort((a,b) => a.length_m - b.length_m)[0];
    const allowed = arcs.filter(a => a.access.status === 'allowed');
    if (allowed.length === 1) return allowed[0];
    if (allowed.length === 2) { const a = shortest(allowed); return { ...a, access: { ...a.access, status: 'unknown', kind: 'unknown', reason: 'Both simple junction arcs allow cars; route correspondence is ambiguous' } }; }
    const uncertain = arcs.filter(a => a.access.status === 'unknown');
    const result = shortest(uncertain.length ? uncertain : arcs);
    if (!uncertain.length) {
      const evidence = [...new Set(arcs.flatMap(a => a.access.source_ids ?? []))];
      if (arcs.every(a => a._soleDirection) && incoherentCirculation(start)) return { ...result, access: { ...result.access, status: 'unknown', kind: 'unknown', evidence_status: 'conflicting', reason: 'Mapped one-way directions produce inconsistent junction circulation', source_ids: evidence } };
      return { ...result, access: { ...result.access, source_ids: evidence } };
    }
    return result;
  };
  const forward = direction(fromNode, toNode, fromWayId, toWayId), reverse = direction(toNode, fromNode, toWayId, fromWayId);
  if (!forward || !reverse) return null;
  delete forward._soleDirection; delete reverse._soleDirection;
  return { forward, reverse };
}
