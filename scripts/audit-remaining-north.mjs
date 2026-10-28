// Independent snapshot checks; neither city designations nor OSM establish present-day signs.
import { locate, metres } from './route-network.mjs';

export function auditRemainingNorth({ data, db, cityRecords, evidenceRecords, check, sourceUrl }) {
  const expected = {
    lakewood: 'row-dvmp~z8xt_i37a', northShore: 'row-i74w-x7ng.sgri',
    juneway: 'row-ie9a-8v4h~zs89', paulina: 'row-u6sm-hs97~vkz5',
    farwell: 'row-jnzi_c7zj-crny', eastwood: 'row-q89g_kydj.7hkd',
    virginia: 'row-stjm_dixi~3h89', spaulding: 'row-xqxw_seh8.u2gq',
  };
  const city = id => cityRecords.find(r => r[':id'] === id);
  const routes = id => data.routes.filter(r => r.source_ids.includes(id));
  const way = id => { const w = db.prepare('SELECT nodes,tags FROM ways WHERE id=?').get(id); return w && { nodes: JSON.parse(w.nodes), tags: JSON.parse(w.tags) }; };
  const coord = id => { const n = db.prepare('SELECT lon,lat FROM nodes WHERE id=?').get(id); return n && [n.lon, n.lat]; };
  const osm = id => `https://www.openstreetmap.org/way/${id}`;
  const all = Object.values(expected);
  for (const [name,id] of Object.entries(expected)) {
    const matching = routes(id);
    check(`remaining-north-${name}-scope`, true, city(id)?.displayrou === 'Neighborhood Greenway' && matching.length === 1 && matching[0].source_ids.filter(v => v === id).length === 1, 'City record occurs in one route component; this does not assert a separate project.', [sourceUrl]);
  }
  check('remaining-north-review-evidence', true, all.every(id => evidenceRecords.some(e => e.source_record_ids?.includes(id) && e.review_status === 'source-inferred')), 'All eight city records have snapshot review evidence.', [sourceUrl]);

  // A designated bike/foot path cannot become a car edge or an allowed shortcut.
  for (const [name,id,nonMotor] of [['eastwood',expected.eastwood,697243564], ['juneway',expected.juneway,163534560]]) {
    const tagged = way(nonMotor), applicable = routes(id), edges = applicable.flatMap(r => r.edges);
    const absent = !edges.some(e => e.way_id === nonMotor || e.way_ids?.includes(nonMotor) || Object.values(e.traversals ?? {}).some(t => t.source_way_ids?.includes(nonMotor)));
    const middle = tagged && coord(tagged.nodes[Math.floor(tagged.nodes.length / 2)]);
    const gap = middle && edges.some(e => e.role === 'gap' && e.access?.forward?.status === 'unknown' && e.access?.reverse?.status === 'unknown' && e.geometry?.coordinates?.length >= 2 && locate(middle, e.geometry.coordinates).distance <= 18);
    check(`remaining-north-${name}-noncar-gap`, true, !!tagged && ['cycleway','footway','path'].includes(tagged.tags.highway) && absent && gap, 'Non-motor connector stays outside car edges and leaves an unknown route gap.', [sourceUrl,osm(nonMotor)]);
  }

  // Verify every output point and interpolated metre is within its own route component's
  // city corridor; clipping is tested against city endpoints, not whole OSM way endpoints.
  const within = (geometry, ids, limit) => {
    const lines = ids.flatMap(id => city(id)?.the_geom?.coordinates ?? []);
    if (!lines.length || !Array.isArray(geometry) || geometry.length < 2) return false;
    return geometry.every((p,i) => {
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return false;
      const a = i ? geometry[i-1] : p, steps = Math.max(1, Math.ceil(metres(a,p)));
      return Array.from({length:steps+1},(_,j) => [a[0]+(p[0]-a[0])*j/steps,a[1]+(p[1]-a[1])*j/steps]).every(q => Math.min(...lines.map(line => locate(q,line).distance)) <= limit);
    });
  };
  for (const [name,id,wid] of [['juneway',expected.juneway,33805383], ['spaulding',expected.spaulding,1081688366]]) {
    const source = way(wid), raw = source?.nodes.map(coord), edges = routes(id).flatMap(r => r.edges.filter(e => e.way_id === wid));
    const cityLine = city(id)?.the_geom?.coordinates?.[0];
    const bounded = edges.every(e => within(e.geometry?.coordinates, [id], 18));
    const endpoints = edges.flatMap(e => [e.geometry.coordinates[0], e.geometry.coordinates.at(-1)]);
    const clipped = raw?.every(Boolean) && cityLine && endpoints.some(p => cityLine.some(q => Math.abs(locate(p,raw).position - locate(q,raw).position) < 1));
    const unresolved = routes(id).some(r => r.edges.some(e => e.role === 'gap' && e.access.forward.status === 'unknown' && e.access.reverse.status === 'unknown')) && evidenceRecords.some(e => e.source_record_ids?.includes(id) && e.review_status === 'source-inferred' && typeof e.review_needed === 'string' && e.review_needed.trim());
    check(`remaining-north-${name}-bounded-clipping`, true, !!source && (edges.length ? bounded && !!clipped : unresolved), 'Selected road geometry is bounded by the city line and actually clipped at its projected endpoint; an unresolved gap remains acceptable.', [sourceUrl,osm(wid)]);
  }

  // These roads are mapped one-way; node order determines the permitted direction,
  // independently of bicycle exceptions and the city bicycle-direction field.
  for (const [name,id,wid] of [['north-shore',expected.northShore,1118445938], ['juneway',expected.juneway,624602056], ['farwell',expected.farwell,624602065], ['virginia',expected.virginia,130320116], ['spaulding',expected.spaulding,1081688366]]) {
    const source = way(wid), raw = source?.nodes.map(coord), edges = routes(id).flatMap(r => r.edges.filter(e => e.way_id === wid));
    const unresolved = routes(id).some(r => r.edges.some(e => e.role === 'gap' && e.access.forward.status === 'unknown' && e.access.reverse.status === 'unknown')) && evidenceRecords.some(e => e.source_record_ids?.includes(id) && e.review_status === 'source-inferred' && typeof e.review_needed === 'string' && e.review_needed.trim());
    const correct = edges.every(e => {
      const p=e.geometry?.coordinates?.[0], q=e.geometry?.coordinates?.at(-1);
      if (!p || !q || !raw?.every(Boolean)) return false;
      const forward=locate(q,raw).position > locate(p,raw).position;
      return e.access?.[forward?'forward':'reverse']?.status === 'allowed' && e.access?.[forward?'reverse':'forward']?.status === 'blocked';
    });
    check(`remaining-north-${name}-motor-direction`, true, source?.tags.oneway === 'yes' && (edges.length > 0 ? correct : !!unresolved), 'If selected, movement follows the mapped motor one-way; bicycle exceptions do not allow cars.', [sourceUrl,osm(wid)]);
  }
  const branchIds = [458591866, 1322030768];
  const branches = branchIds.map(way), branchEdges = routes(expected.northShore).flatMap(r => r.edges.filter(e => branchIds.includes(e.way_id)));
  const branchGap = routes(expected.northShore).some(r => r.edges.some(e => e.role === 'gap' && e.access.forward.status === 'unknown' && e.access.reverse.status === 'unknown')) && evidenceRecords.some(e => e.source_record_ids?.includes(expected.northShore) && typeof e.review_needed === 'string' && e.review_needed.trim());
  const parallel = branches.every(w => w?.nodes[0] === 4545743745 && w.nodes.at(-1) === 4545743744 && w.tags.highway === 'residential' && w.tags.oneway === 'yes') && branches[0].nodes.slice(1,-1).every(n => !branches[1].nodes.slice(1,-1).includes(n));
  check('remaining-north-north-shore-parallel', true, !!parallel && (branchEdges.length > 0 ? branchEdges.every(e => within(e.geometry.coordinates, [expected.northShore], 18) && e.access.forward.status !== 'unknown' && e.access.reverse.status !== 'unknown') : !!branchGap), 'The parallel underpass ways share endpoints and one-way direction; selection stays within the city corridor or remains unresolved.', [sourceUrl,...branchIds.map(osm)]);
  for (const [name,id,ids] of [['lakewood',expected.lakewood,[976197309,1118445937]], ['paulina',expected.paulina,[624602060]]]) {
    const sources = ids.map(way), edges=routes(id).flatMap(r=>r.edges.filter(e=>ids.includes(e.way_id)));
    const gap=routes(id).some(r=>r.edges.some(e=>e.role==='gap' && e.access.forward.status==='unknown' && e.access.reverse.status==='unknown')) && evidenceRecords.some(e=>e.source_record_ids?.includes(id) && typeof e.review_needed==='string' && e.review_needed.trim());
    const tags=sources.every(w=>w?.tags.highway==='residential' && !['oneway','access','vehicle','motor_vehicle','motorcar'].some(k=>w.tags[k]));
    check(`remaining-north-${name}-two-way`, true, tags && (edges.length ? edges.every(e=>e.access.forward.status==='allowed' && e.access.reverse.status==='allowed') : !!gap), 'The selected mapped streets have no explicit motor restriction; missing matching remains unknown.', [sourceUrl,...ids.map(osm)]);
  }

}
