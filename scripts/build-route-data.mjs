import { DatabaseSync } from "node:sqlite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { assemble, alignedGraph, locate, metres, lineLength, shortestPath, compareCityOneWay, clipTerminal, acceptsUnnamedWay, designationRecords, joinForReview } from "./route-network.mjs";
import { edgeAccess, movementAccess } from "./motor-rules.mjs";
import { traceRoute } from "./route-continuity.mjs";
import { traceJunction } from "./junction-traversal.mjs";
import { gapReviewContext, inferGapFilter } from "./route-evidence.mjs";
import { addScopedRouteWay } from "./scoped-route-ways.mjs";
import { compileEvidenceCatalog } from "./evidence-catalog.mjs";
import { compileCoverageInventory } from "./coverage-inventory.mjs";
import { resolveMatchingReview } from "./matching-review.mjs";
import { addSplitCarriageway } from "./split-carriageways.mjs";
import { resolveExplicitRoadMatches } from "./explicit-road-matches.mjs";
import { componentRouteIds } from "./component-route-ids.mjs";
import { createHash } from "node:crypto";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const [source, config, osm, reviewEvidence] = await Promise.all(["data/sources/greenways.json", "data/routes/pilots.json", "data/sources/osm-source.json", "data/routes/review-evidence.json"].map(json));
// Validate the entire CDOT population before generating or writing any routes.
compileCoverageInventory({cityRecords:source,routes:[]});
const sourceMetadata = (await json('data/sources/sources.json')).find(item => item.file === 'greenways.json');
const cityBytes = await readFile('data/sources/greenways.json');
if (!sourceMetadata || createHash('sha256').update(cityBytes).digest('hex') !== sourceMetadata.sha256) throw new Error('City source hash does not match manifest');
const catalogText = `${JSON.stringify(compileEvidenceCatalog(reviewEvidence), null, 2)}\n`;
const db = new DatabaseSync("data/staging/network.sqlite", { readOnly: true });
const query = db.prepare("SELECT w.* FROM way_bounds b JOIN ways w ON w.id=b.id WHERE b.min_lon<=? AND b.max_lon>=? AND b.min_lat<=? AND b.max_lat>=?");
const getNode = db.prepare("SELECT lon,lat,tags FROM nodes WHERE id=?");
const getWay = db.prepare("SELECT id,nodes,tags FROM ways WHERE id=?");
const relations = [...db.prepare("SELECT * FROM relations WHERE json_extract(tags,'$.type')='restriction'").iterate()].map((r) => ({ id: r.id, members: JSON.parse(r.members), tags: JSON.parse(r.tags) }));
const unknown = (reason) => ({ status: "unknown", reason, kind: "unknown", evidence_status: "source-inferred" });
const pointAt = (line, position) => {
  let s = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], len = Math.hypot((b[0] - a[0]) * 83100, (b[1] - a[1]) * 111100);
    if (s + len >= position) {
      let t = len ? (position - s) / len : 0;
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    }
    s += len;
  }
  return line.at(-1);
};
const subline = (line, a, b) => {
  let coords = [pointAt(line, a)], s = 0;
  for (let i = 1; i < line.length; i++) {
    s += Math.hypot((line[i][0] - line[i - 1][0]) * 83100, (line[i][1] - line[i - 1][1]) * 111100);
    if (s > a && s < b) coords.push(line[i]);
  }
  coords.push(pointAt(line, b));
  return coords;
};
const norm = (s) => (s ?? "").toUpperCase().replace(/^(N|S|E|W|NORTH|SOUTH|EAST|WEST) /, "").replace(/ (AVENUE|AVE|STREET|ST|ROAD|RD|DRIVE|DR|BOULEVARD|BLVD|PLACE|PL|COURT|CT|PARKWAY|PKWY|TERRACE|TER|LANE|LN)$/, "");
const all = [];
for (const spec of config.streets) {
  const routePrefix = spec.name.toLowerCase().replace(/\s+/g, '-');
  const records = designationRecords(source, spec);
  let components = assemble(records, spec.axis);
  if (spec.review_connection) components = joinForReview(components, spec.review_connection, reviewEvidence.records);
  if (["LELAND", "DICKENS"].includes(spec.source) && components.length === 2) {
    const [a, b] = components;
    components = [{ coords: [...a.coords, ...b.coords], ids: [...a.ids, ...b.ids], designationLines: [a.coords, b.coords], connector: [a.coords.at(-1), b.coords[0]] }];
  }
  const routeIds = componentRouteIds(components, routePrefix, spec.component_ids ?? []);
  const componentIds = new Set(routeIds);
  for (const binding of spec.scoped_ways ?? []) {
    if (!componentIds.has(binding.route_id)) throw new Error(`Scoped way ${binding.way_id} refers to missing route ${binding.route_id}`);
  }
  for (const binding of spec.split_carriageways ?? []) {
    if (!componentIds.has(binding.route_id)) throw new Error(`Split carriageway refers to missing route ${binding.route_id}`);
  }
  for (const binding of spec.explicit_ways ?? []) {
    if (!componentIds.has(binding.route_id)) throw new Error(`Explicit road match refers to missing route ${binding.route_id}`);
  }
  for (const binding of spec.unresolved_components ?? []) {
    if (!Array.isArray(binding.source_ids) || binding.source_ids.some(sourceId=>!records.some(record=>record[':id']===sourceId))) throw new Error(`Unresolved component refers to an unselected city record on ${spec.name}`);
  }
  for (let ix = 0; ix < components.length; ix++) {
    const part = components[ix], line = part.coords, id = routeIds[ix];
    const matchingReview = resolveMatchingReview({bindings:spec.unresolved_components ?? [],componentIds:part.ids,evidenceRecords:reviewEvidence.records});
    const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
    const ways = [], nodeCounts = /* @__PURE__ */ new Map(), crossingNames = /* @__PURE__ */ new Map();
    const nearby = [...query.iterate(Math.max(...xs) + 3e-4, Math.min(...xs) - 3e-4, Math.max(...ys) + 3e-4, Math.min(...ys) - 3e-4)];
    for (const w of nearby) {
      const tags = JSON.parse(w.tags);
      for (const n of JSON.parse(w.nodes)) {
        nodeCounts.set(n, (nodeCounts.get(n) ?? 0) + 1);
        if (tags.name && norm(tags.name) !== spec.source && tags.highway && !["footway", "cycleway", "path"].includes(tags.highway)) {
          if (!crossingNames.has(n)) crossingNames.set(n, /* @__PURE__ */ new Set());
          crossingNames.get(n).add(tags.name);
        }
      }
    }
    for (const w of nearby) {
      const tags = JSON.parse(w.tags);
      const parkPath = spec.source === "DICKENS" && part.connector && ["cycleway", "path"].includes(tags.highway);
      if (tags.name ? norm(tags.name) !== spec.source && !parkPath : !acceptsUnnamedWay(tags, parkPath)) continue;
      const nodes = JSON.parse(w.nodes), data = nodes.map((n) => getNode.get(n));
      if (data.some((n) => !n)) continue;
      if (parkPath && !data.some((n) => locate([n.lon, n.lat], part.connector).distance < 18)) continue;
      if (!tags.name && !tags.junction && !parkPath && lineLength(data.map((n) => [n.lon, n.lat])) > 45) continue;
      ways.push({ id: w.id, tags, nodes, coordinates: data.map((n) => [n.lon, n.lat]), nodeTags: data.map((n) => JSON.parse(n.tags || "{}")) });
    }
    const explicitBindings = (spec.explicit_ways ?? []).filter(binding => binding.route_id === id);
    if (matchingReview && explicitBindings.length) throw new Error(`Cannot add explicit roads to unresolved component ${id}`);
    const explicitIds = new Set(explicitBindings.flatMap(binding => binding.way_ids ?? []));
    const explicitCandidates = nearby.filter(raw => explicitIds.has(raw.id)).map(raw => {
      const nodes = JSON.parse(raw.nodes), data = nodes.map(node => getNode.get(node));
      return {id:raw.id,tags:JSON.parse(raw.tags),nodes,coordinates:data.map(node=>node ? [node.lon,node.lat] : null),nodeTags:data.map(node=>node ? JSON.parse(node.tags || '{}') : {})};
    });
    for (const way of resolveExplicitRoadMatches({bindings:explicitBindings,routeId:id,componentIds:part.ids,evidenceRecords:reviewEvidence.records,ways:explicitCandidates})) {
      way.match_lines=way.explicit_match.city_source_ids.flatMap(sourceId=>records.find(record=>record[':id']===sourceId).the_geom.coordinates);
      const existing=ways.findIndex(candidate=>candidate.id===way.id);
      if (existing>=0) ways[existing]=way;
      else ways.push(way);
    }
    const graph = matchingReview ? new Map() : alignedGraph(line, ways, config.max_source_distance_m), visited = /* @__PURE__ */ new Set(), candidates = [];
    for (const binding of spec.scoped_ways ?? []) {
      if (binding.route_id !== id) continue;
      if (matchingReview) throw new Error(`Cannot add a scoped way to unresolved matching component ${id}`);
      const raw = nearby.find(w => w.id === binding.way_id);
      if (!raw) throw new Error(`Scoped way ${binding.way_id} not found near ${id}`);
      const nodes = JSON.parse(raw.nodes), data = nodes.map(n => getNode.get(n));
      if (data.some(n => !n)) throw new Error(`Scoped way ${binding.way_id} has missing nodes`);
      const way = { id:raw.id, tags:JSON.parse(raw.tags), nodes, coordinates:data.map(n => [n.lon,n.lat]), nodeTags:data.map(n => JSON.parse(n.tags || '{}')) };
      ways.push(addScopedRouteWay({ graph, way, binding, cityRecords:records, componentIds:part.ids, routeAxis:spec.axis }));
    }
    const junctionGroups = new Map();
    for (const binding of spec.split_carriageways ?? []) {
      if (binding.route_id !== id) continue;
      if (matchingReview) throw new Error(`Cannot add a split carriageway to unresolved component ${id}`);
      const group = addSplitCarriageway({graph,ways,binding,cityRecords:records,componentIds:part.ids,evidenceRecords:reviewEvidence.records,
        incidentWays:nearby.map(w=>({id:w.id,nodes:JSON.parse(w.nodes),tags:JSON.parse(w.tags)}))});
      for (const way of group) junctionGroups.set(way.id, group);
    }
    const ungrouped = new Set(ways.filter(way => ["circular", "roundabout"].includes(way.tags.junction)));
    while (ungrouped.size) {
      const queue = [ungrouped.values().next().value], group = [];
      ungrouped.delete(queue[0]);
      while (queue.length) {
        const way = queue.pop(); group.push(way);
        for (const other of ungrouped) if (other.nodes.some(node => way.nodes.includes(node))) {
          ungrouped.delete(other); queue.push(other);
        }
      }
      for (const way of group) junctionGroups.set(way.id, group);
    }
    for (const node of graph.keys()) {
      if (visited.has(node)) continue;
      const stack = [node], nodes = [];
      visited.add(node);
      while (stack.length) {
        const n = stack.pop();
        nodes.push(n);
        for (const e of graph.get(n) ?? []) if (!visited.has(e.to)) {
          visited.add(e.to);
          stack.push(e.to);
        }
      }
      const positions = nodes.map((n) => {
        const edge = graph.get(n)[0], i = edge.reversed ? edge.index + 1 : edge.index;
        const coord = edge.way.coordinates[i];
        return { id: n, coord, ...locate(coord, line) };
      }).sort((a, b) => a.position - b.position);
      if (positions.length < 2) continue;
      const first = positions[0], last = positions.at(-1), path = shortestPath(graph, first.id, last.id);
      if (path?.length && last.position - first.position > 5) candidates.push({ first, last, path });
    }
    candidates.sort((a, b) => a.first.position - b.first.position);
    const total = locate(line.at(-1), line).position;
    let cursor = 0;
    const edges = [];
    let startResolved = true, endResolved = true;
    const gap = (a, b) => {
      if (b - a < 0.5) return;
      const coords = subline(line, a, b);
      const context = gapReviewContext(reviewEvidence.records, id, part.ids, coords);
      if (matchingReview) context.push(reviewEvidence.records.find(record=>record.id===matchingReview.evidence_id));
      const note = context.map(record => record.gap_note ?? record.matching_review).join(" ");
      const reason = `Designation could not be confidently matched to a connected OSM route.${note ? ` ${note}` : ''}`;
      edges.push({ id: `${id}-gap-${edges.length + 1}`, way_id: null, from_node: null, to_node: null, length_m: lineLength(coords), geometry: { type: "LineString", coordinates: coords }, access: { forward: unknown(reason), reverse: unknown(reason) }, evidence_urls: [...new Set(context.flatMap(record => record.sources.map(source => source.url)))], ...(note ? {review_note:note,evidence_ids:context.map(record => record.id)} : {}), role: "gap", source_range: [a, b] });
    };
    for (const c of candidates) {
      if (c.first.position < cursor - 3) continue;
      gap(cursor, c.first.position);
      let chunks = [];
      for (const e of c.path) {
        const prior = chunks.at(-1);
        const junctionWays = junctionGroups.get(e.way.id);
        const sameJunction = junctionWays && prior?.junctionWays === junctionWays;
        if (prior && prior.to === e.from && (sameJunction || (prior.way.id === e.way.id && prior.reversed === e.reversed && (nodeCounts.get(e.from) ?? 0) < 2 && !Object.keys(JSON.parse(getNode.get(e.from).tags || "{}")).length))) {
          prior.to = e.to;
          prior.parts.push(e);
        } else chunks.push({ way: e.way, reversed: e.reversed, from: e.from, to: e.to, parts: [e], junctionWays });
      }
      for (const [chunkIndex, chunk] of chunks.entries()) {
        let coords = [];
        for (const p of chunk.parts) {
          const a = p.way.coordinates[p.reversed ? p.index + 1 : p.index], b = p.way.coordinates[p.reversed ? p.index : p.index + 1];
          if (!coords.length) coords.push(a);
          coords.push(b);
        }
        if (c.first.position < 0.5 && chunkIndex === 0) {
          const clipped = clipTerminal(coords, line[0], "start");
          coords = clipped.coords;
          startResolved = clipped.resolved;
        }
        if (total - c.last.position < 0.5 && chunkIndex === chunks.length - 1) {
          const clipped = clipTerminal(coords, line.at(-1), "end");
          coords = clipped.coords;
          endResolved = clipped.resolved;
        }
        const tags = chunk.parts.slice(0, -1).map((p) => p.way.nodeTags[p.reversed ? p.index : p.index + 1]).filter((t) => Object.keys(t).length);
        let access = edgeAccess(chunk.way.tags, { reversed: chunk.reversed, nodeTags: tags });
        let traversals;
        if (chunk.junctionWays) {
          const completeFootprint = chunk.junctionWays.every(way => way.nodes.slice(1).every((_, index) => graph.get(way.nodes[index])?.some(edge => edge.way.id === way.id && edge.index === index)));
          const before = chunks[chunkIndex - 1], after = chunks[chunkIndex + 1];
          traversals = completeFootprint && !before?.junctionWays && !after?.junctionWays ? traceJunction({
            ways: chunk.junctionWays, fromNode: chunk.from, toNode: chunk.to,
            fromWayId: before?.way.id, toWayId: after?.way.id, relations,
          }) : null;
          if (traversals) {
            access = {forward:traversals.forward.access, reverse:traversals.reverse.access};
            coords = traversals.forward.geometry.coordinates;
          } else {
            access = {forward:unknown("This junction needs a complete, bounded directional path before car continuity can be established."),reverse:unknown("This junction needs a complete, bounded directional path before car continuity can be established.")};
          }
        }
        const sourceAccess = structuredClone(access);
        if (["cycleway", "path"].includes(chunk.way.tags.highway)) {
          access.forward = unknown("A bicycle path matches this connector; its corresponding motor route is unresolved.");
          access.reverse = unknown("A bicycle path matches this connector; its corresponding motor route is unresolved.");
        }
        const cityAt = (p) => records.filter((r) => part.ids.includes(r[":id"])).map((r) => ({ r, d: locate(p, r.the_geom.coordinates[0]).distance })).sort((a, b) => a.d - b.d)[0];
        const mid = pointAt(coords, locate(coords.at(-1), coords).position / 2), city = cityAt(mid);
        const splitMatch = chunk.junctionWays?.[0]?.split_match;
        if ((!chunk.junctionWays || splitMatch) && (!chunk.way.scoped_match || chunk.way.scoped_match.city_direction_axis) && city?.d < 25) {
          const beforeCity = structuredClone(access);
          access = compareCityOneWay(beforeCity, city.r.oneway_dir, spec.axis);
          // A matched edge can straddle city records with different assertions.
          const ends = [coords[0], coords.at(-1)].map(cityAt).filter(c => c?.d < 25);
          for (const end of ends) {
            const other = compareCityOneWay(beforeCity, end.r.oneway_dir, spec.axis);
            for (const direction of ['forward', 'reverse']) if (other[direction].status !== access[direction].status) {
              access[direction] = { ...unknown('This edge crosses city records with different one-way assertions; the boundary needs review.'), evidence_status: 'conflicting' };
            }
          }
        }
        const bridge = part.connector ? [locate(part.connector[0], line).position, locate(part.connector[1], line).position].sort((a, b) => a - b) : null;
        const edgePositions = coords.map((p) => locate(p, line).position), low = Math.min(...edgePositions), high = Math.max(...edgePositions);
        const overlapsJoin = bridge && Math.min(high, bridge[1]) - Math.max(low, bridge[0]) > 0.05;
        if (overlapsJoin) {
          access = { forward: unknown("The connector between separate designation records has not been reviewed."), reverse: unknown("The connector between separate designation records has not been reviewed.") };
        }
        // Explicit evidence bindings enrich the source explanation, never override
        // motor rules or extend a project assertion onto a neighboring block.
        const evidenceRecords = reviewEvidence.records.filter(record => (chunk.junctionWays ?? [chunk.way]).some(way => record.way_ids?.includes(way.id)));
        for (const direction of ["forward", "reverse"]) {
          const notes = evidenceRecords.filter(record => record.direction_notes?.[direction]);
          if (notes.length && access[direction].status === "blocked" && access[direction].kind === "direction") {
            access[direction] = { ...access[direction], source_reason: access[direction].reason, reason: notes.map(record => record.direction_notes[direction]).join(" "), evidence_ids: notes.map(record => record.id) };
          }
        }
        const wayIds = (chunk.junctionWays ?? [chunk.way]).map(way => way.id).sort((a,b) => a-b);
        const evidenceUrls = [...new Set([...wayIds.map(wayId => `https://www.openstreetmap.org/way/${wayId}`), ...Object.values(access).flatMap(decision => (decision.source_ids ?? []).map(sourceId => `https://www.openstreetmap.org/${sourceId}`)), ...evidenceRecords.flatMap(record => record.sources.map(source => source.url))])];
        // Traversal geometry retains its direction-specific arc, while exported
        // permissions also include any conflicting CDOT cardinal assertion.
        if (traversals) for (const direction of ['forward','reverse']) traversals[direction].access = access[direction];
        edges.push({ id: `${id}-${chunk.junctionWays ? "junction" : "way"}-${wayIds.join("-")}-${edges.length + 1}`, way_id: wayIds.length === 1 ? wayIds[0] : null, ...(chunk.junctionWays ? {way_ids:wayIds} : {}), from_node: chunk.from, to_node: chunk.to, length_m: lineLength(coords), geometry: { type: "LineString", coordinates: coords }, access, ...(traversals ? {traversals} : {}), ...overlapsJoin ? { source_access: sourceAccess } : {}, evidence_urls: evidenceUrls, ...(splitMatch ? {matching:splitMatch} : chunk.way.scoped_match ? { matching: chunk.way.scoped_match } : chunk.way.explicit_match ? {matching:chunk.way.explicit_match} : {}), role: overlapsJoin ? "connector" : chunk.junctionWays ? "junction" : chunk.way.tags.name ? "designated" : "connector" });
      }
      cursor = Math.max(cursor, c.last.position);
    }
    gap(cursor, total);
    if (!edges.length) gap(0, total);
    for (const [index,edge] of edges.entries()) {
      if (edge.role !== 'gap') continue;
      for (const record of gapReviewContext(reviewEvidence.records,id,part.ids,edge.geometry.coordinates)) {
        const filter = record.gap_filter;
        if (!filter) continue;
        const readWay = wayId => { const row=getWay.get(wayId); if(!row) return null; const nodes=JSON.parse(row.nodes);return {id:row.id,nodes,tags:JSON.parse(row.tags),coordinates:nodes.map(id=>{const n=getNode.get(id);return n ? [n.lon,n.lat] : null;})}; };
        const node=getNode.get(filter.boundary_node);
        const incidentWays=nearby.filter(way=>JSON.parse(way.nodes).includes(filter.boundary_node)).map(way=>({id:way.id,nodes:JSON.parse(way.nodes),tags:JSON.parse(way.tags)}));
        edge.access=inferGapFilter({record,routeId:id,sourceIds:part.ids,gap:edge,before:edges[index-1],after:edges[index+1],cycleway:readWay(filter.cycleway_id),road:readWay(filter.road_way_id),boundaryNode:node ? {id:filter.boundary_node,coordinate:[node.lon,node.lat],tags:JSON.parse(node.tags)} : null,connectionWays:filter.connection_path?.map(segment=>readWay(segment.way_id)),incidentWays});
        edge.evidence_urls=[...new Set([...edge.evidence_urls,...Object.values(edge.access).flatMap(access=>access.source_ids.map(source=>`https://www.openstreetmap.org/${source}`))])];
      }
    }
    const movements = [];
    for (let i = 1; i < edges.length; i++) {
      const a = edges[i - 1], b = edges[i], connected = a.to_node != null && a.to_node === b.from_node;
      const forward = connected ? movementAccess({ fromWayId: a.traversals?.forward.exit_way_id ?? a.way_id, toWayId: b.traversals?.forward.entry_way_id ?? b.way_id, viaNodeId: a.to_node, relations, isUTurn: false, viaNodeTags: { id: a.to_node, tags: JSON.parse(getNode.get(a.to_node).tags || "{}") } }) : unknown("A source alignment gap leaves this movement unresolved.");
      const reverse = connected ? movementAccess({ fromWayId: b.traversals?.reverse.exit_way_id ?? b.way_id, toWayId: a.traversals?.reverse.entry_way_id ?? a.way_id, viaNodeId: a.to_node, relations, isUTurn: false, viaNodeTags: { id: a.to_node, tags: JSON.parse(getNode.get(a.to_node).tags || "{}") } }) : unknown("A source alignment gap leaves this movement unresolved.");
      const gapEdges = [a,b].filter(edge => edge.role === 'gap' && edge.review_note);
      if (!connected && gapEdges.length) {
        const note = [...new Set(gapEdges.map(edge => edge.review_note))].join(' ');
        forward.reason += ` ${note}`; reverse.reason += ` ${note}`;
      }
      const urls = [...new Set([...([...forward.source_ids ?? [], ...reverse.source_ids ?? []].map((x) => `https://www.openstreetmap.org/${String(x)}`)), ...gapEdges.flatMap(edge => edge.evidence_urls)])];
      movements.push({ id: `${id}-movement-${i}`, coordinate: a.geometry.coordinates.at(-1), from_edge: a.id, to_edge: b.id, forward, reverse, evidence_urls: urls, cross_street: connected ? [...crossingNames.get(a.to_node) ?? []].sort().join(" / ") || null : null });
    }
    const nearbyOther = (p) => components.some((c) => c !== part && Math.min(metres(p, c.coords[0]), metres(p, c.coords.at(-1))) < 300);
    const endpoints = { start: { kind: edges[0].role === "gap" ? "unknown" : "scope_end", reason: edges[0].role === "gap" ? "The designated endpoint is unmatched." : "End of mapped greenway.", coordinate: line[0] }, end: { kind: edges.at(-1).role === "gap" ? "unknown" : "scope_end", reason: edges.at(-1).role === "gap" ? "The designated endpoint is unmatched." : "End of mapped greenway.", coordinate: line.at(-1) } };
    if (!startResolved) endpoints.start = { kind: "unknown", reason: "The route start could not be projected onto the matched road.", coordinate: line[0] };
    if (!endResolved) endpoints.end = { kind: "unknown", reason: "The route end could not be projected onto the matched road.", coordinate: line.at(-1) };
    for (const [side, p] of [["start", line[0]], ["end", line.at(-1)]]) if (nearbyOther(p)) endpoints[side] = { kind: "unknown", reason: "Another designated section is nearby, but the intervening connection is not established by the city records.", coordinate: p };
    const traced = traceRoute({ id, profile: "through_car", edges, movements, endpoints });
    const byId = new Map(edges.map((e) => [e.id, e]));
    const runs = traced.runs.map((r, i) => {
      const lines = r.edge_ids.map((e) => {
        const edge = byId.get(e);
        if (edge.traversals?.[r.direction]) return edge.traversals[r.direction].geometry.coordinates;
        const c = edge.geometry.coordinates;
        return r.direction === "reverse" ? [...c].reverse() : c;
      });
      return { ...r, start: { ...r.start, coordinate: lines[0][0] }, end: { ...r.end, coordinate: lines.at(-1).at(-1) }, id: `${id}-run-${i + 1}`, geometry: { type: "MultiLineString", coordinates: lines }, evidence_status: "source-inferred" };
    });
    const events = [];
    for (const direction of ["forward", "reverse"]) {
      const ordered = direction === "forward" ? edges : [...edges].reverse();
      let previous = null;
      for (const e of ordered) {
        const d = e.access[direction];
        const key = d.status === "allowed" ? null : `${d.status}|${d.kind}|${d.reason}`;
        if (key && key !== previous) events.push({ id: `${e.id}-${direction}`, coordinate: direction === "forward" ? e.geometry.coordinates[0] : e.geometry.coordinates.at(-1), direction, ...d, evidence_urls: e.evidence_urls });
        previous = key;
      }
    }
    for (const m of movements) for (const direction of ["forward", "reverse"]) if (m[direction].status !== "allowed") events.push({ id: `${m.id}-${direction}`, coordinate: m.coordinate, direction, ...m[direction], evidence_urls: m.evidence_urls });
    if (spec.source === "DICKENS") events.push({ id: "dickens-oz-park-context", coordinate: part.connector?.[0] ?? line.at(-1), direction: "forward", status: "unknown", kind: "unknown", reason: "The mapped corridor joins the city sections through Oz Park, but the motor connection has not been reviewed. OSM includes destination-only access and bike paths in this area.", evidence_status: "source-inferred", evidence_urls: ["https://www.openstreetmap.org/way/1237331792"] });
    const designated = part.designationLines ? part.designationLines.reduce((n, l) => n + lineLength(l), 0) : lineLength(line);
    const intervals = part.designationLines ? part.designationLines.map((l) => [locate(l[0], line).position, locate(l.at(-1), line).position].sort((a, b) => a - b)) : [[0, total]];
    const unmatched = edges.filter((e) => e.role === "gap").reduce((n, e) => n + intervals.reduce((sum, [a, b]) => {
      const start = Math.max(a, e.source_range[0]), end = Math.min(b, e.source_range[1]);
      return sum + (end > start ? lineLength(subline(line, start, end)) : 0);
    }, 0), 0), matched = Math.max(0, designated - unmatched);
    const labelAt = (p) => {
      let options = [];
      for (const [n, names] of crossingNames) {
        const nd = getNode.get(n);
        if (nd) {
          const distance = metres(p, [nd.lon, nd.lat]);
          if (distance < 45) options.push({ distance, name: [...names].sort()[0] });
        }
      }
      options.sort((a, b) => a.distance - b.distance);
      return options[0]?.name?.replace(/^(North|South|East|West) /, "") ?? "unresolved endpoint";
    };
    all.push({ id, ...(matchingReview ? {matching_review:matchingReview} : {}), name: spec.name, extent_label: `${labelAt(line[0])} \u2013 ${labelAt(line.at(-1))}`, direction_labels: spec.axis === "north" ? { forward: "Northbound", reverse: "Southbound" } : { forward: "Eastbound", reverse: "Westbound" }, source_ids: part.ids, bounds: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], geometry: part.designationLines ? { type: "MultiLineString", coordinates: part.designationLines } : { type: "LineString", coordinates: line }, edges, movements, runs, events, coverage: { designated_m: designated, matched_m: matched, unknown_m: unmatched, unknown_connections: movements.filter(m => m.forward.status === 'unknown' || m.reverse.status === 'unknown').length + edges.filter(e => e.role === 'junction' && (e.access.forward.status === 'unknown' || e.access.reverse.status === 'unknown')).length, reviewed_movements: 0, total_movements: movements.length } });
  }
}
db.close();
const result = { schema_version: 1, generated_at: new Date(process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1e3 : Date.now()).toISOString(), source: { osm_date: "2026-09-11", designation_date: "2025-12", osm_sha256: osm.sha256, osm_attribution: "\xA9 OpenStreetMap contributors", designation_attribution: "City of Chicago Bike Routes", designation_url: "https://data.cityofchicago.org/Transportation/Bike-Routes/hvv9-38ut" }, routes: all, summary: { route_components: all.length, reviewed_movements: 0, total_movements: all.reduce((n, r) => n + r.movements.length, 0), evidence_status: "source-inferred" } };
await mkdir("public/routes", { recursive: true });
await writeFile("public/routes/review-evidence.json", await readFile("data/routes/review-evidence.json"));
await writeFile("data/routes/evidence-catalog.json", catalogText);
await writeFile("public/routes/evidence-catalog.json", catalogText);
const routeText = JSON.stringify(result);
await writeFile("public/routes/pilot.json", routeText);
const coverageText = `${JSON.stringify(compileCoverageInventory({cityRecords: source, routes: all, sourceMetadata, routeSha256: createHash('sha256').update(routeText).digest('hex')}), null, 2)}\n`;
await writeFile('data/routes/coverage-inventory.json', coverageText);
await writeFile('public/routes/coverage-inventory.json', coverageText);
console.log(JSON.stringify(all.map((r) => ({ id: r.id, edges: r.edges.length, movements: r.movements.length, coverage: r.coverage })), null, 2));
