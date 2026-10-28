// Read-only feasibility probe. This is evidence extraction, not an accepted driving audit.
// Run: node scripts/probe-greenway-data.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import geodesic from 'geographiclib-geodesic';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [sources, matches, restrictions, osmSource] = await Promise.all([
  readJson('data/sources/greenways.json'),
  readJson('data/review/city/matches.json'),
  readJson('data/review/city/restrictions.json'),
  readJson('data/sources/osm-source.json'),
]);
const db = new DatabaseSync('data/staging/network.sqlite', { readOnly: true });
const nodeQuery = db.prepare('SELECT * FROM nodes WHERE id=?');
const wayQuery = db.prepare('SELECT * FROM ways WHERE id=?');
const relationQuery = db.prepare('SELECT * FROM relations WHERE id=?');
const nodeCache = new Map();
const node = (id) => {
  if (!nodeCache.has(id)) {
    const row = nodeQuery.get(id);
    nodeCache.set(id, { id, longitude: row.lon, latitude: row.lat, tags: JSON.parse(row.tags) });
  }
  return nodeCache.get(id);
};
const lengthMeters = (coordinates) => coordinates.slice(1).reduce((total, b, index) => {
  const a = coordinates[index];
  return total + geodesic.Geodesic.WGS84.Inverse(a[1], a[0], b[1], b[0]).s12;
}, 0);
const way = (id) => {
  const row = wayQuery.get(id);
  const ids = JSON.parse(row.nodes);
  const geometry = ids.map((id) => { const n = node(id); return [n.longitude, n.latitude]; });
  return { id, tags: JSON.parse(row.tags), node_ids: ids, geometry, length_m: lengthMeters(geometry), source_url: `https://www.openstreetmap.org/way/${id}` };
};
const relation = (id) => {
  const row = relationQuery.get(id);
  return { id, tags: JSON.parse(row.tags), members: JSON.parse(row.members), source_url: `https://www.openstreetmap.org/relation/${id}` };
};
const tally = (values) => Object.fromEntries([...new Set(values)].sort().map((v) => [v, values.filter((x) => x === v).length]));
const candidateWays = new Map(matches.flatMap((m) => m.candidates.map((w) => [w.way_id, w])));
const lengths = matches.map((m) => m.gw_mm / 1000).sort((a, b) => a - b);
const candidateNodes = new Set([...candidateWays.values()].flatMap((w) => w.node_ids));
const taggedNodes = [...candidateNodes].map(node).filter((n) => Object.keys(n.tags).length);
const summaries = ['BERTEAU', 'MANOR', 'DICKENS', 'CORTLAND', 'LELAND', 'KENMORE', 'WOOD'].map((name) => {
  const sourceRows = sources.filter((s) => s.st_name === name);
  const inventoryRows = matches.filter((m) => m.street?.startsWith(name + ' '));
  const ways = new Map(inventoryRows.flatMap((m) => m.candidates.map((w) => [w.way_id, w])));
  return {
    name,
    city_source_records: sourceRows.length,
    city_geometry_intervals: inventoryRows.length,
    source_directions: sourceRows.map((s) => ({ source_id: s[':id'], from: s.f_street, to: s.t_street, motor_direction: s.oneway_dir, bike_direction: s.br_oneway, contraflow: s.contraflow ?? null })),
    candidate_ways: [...ways.values()].map((w) => ({ id: w.way_id, tags: w.tags })),
    directly_attached_relations: restrictions.filter((r) => r.members.some((m) => m.type === 'way' && ways.has(m.ref))),
  };
});
const cases = [
  {
    id: 'berteau-greenview-circle',
    label: 'Berteau / Greenview: name filtering removes an intersection connector',
    coordinates: [-87.667644, 41.957986],
    ways: [1088397389, 1088397391, 24099241].map(way),
    observations: [
      'The unnamed residential circular-junction way is absent from the city candidate list.',
      'It shares node 9971880129 with the east Berteau approach and 9971880117 with the west Berteau approach.',
      'Its geometry is a connector requiring logical-junction treatment; its absence from name-matched candidates is not evidence of a motor blockage.',
      'The approaches are motor-oneway=yes with oneway:bicycle=no. Bicycle contraflow must not create reverse motor travel.',
    ],
    needs_review: 'Confirm current junction circulation and direction from dated imagery or site evidence before accepting a through movement.',
  },
  {
    id: 'leland-western-no-straight',
    label: 'Leland / Western: a connected road can prohibit the specific movement',
    coordinates: [-87.688847, 41.9667811],
    ways: [1464448283, 625511923].map(way),
    relations: [20163015].map(relation),
    observations: [
      'The approach and departure share node 157729865; geometry alone would connect them.',
      'Relation 20163015 explicitly encodes no_straight_on from way 1464448283 to way 625511923.',
      'The restriction is marked implicit=yes; the meaning and current physical treatment need independent verification.',
    ],
    needs_review: 'Verify the current eastbound prohibition and bicycle exemption, if any, with the relevant signs/design and dated evidence.',
  },
  {
    id: 'dickens-burling-destination',
    label: 'Dickens / Burling: local access and bicycle path differ from through access',
    coordinates: [-87.6474063, 41.9200158],
    ways: [223538783, 1237331792, 1237331793, 182082444].map(way),
    observations: [
      'The 2.8 m connector is tagged access=yes and motor_vehicle=destination: motor-specific access overrides the generic tag.',
      'An unnamed cycleway connects the west Dickens endpoint to the longer park cycleway.',
      'The city greenway inventory has separate Dickens records on each side of the park; it does not supply this bicycle connector as a continuous greenway centerline.',
      'A motor_vehicle=destination way is not evidence that unrestricted through driving is permitted, and is not itself proof of a physical barrier.',
    ],
    needs_review: 'Confirm where ordinary through vehicles must leave the corridor; preserve local access separately from through access.',
  },
  {
    id: 'manor-montrose-connectors',
    label: 'Manor / Montrose: short curved connectors and approach-specific restrictions',
    coordinates: [-87.6972397, 41.9613469],
    ways: [24076564, 1373721893, 1373721895, 1322446355, 1373721894, 1373721896].map(way),
    relations: [18923101, 18923102, 18923103, 18923104].map(relation),
    observations: [
      'Two Manor approaches meet the same crosswalk node but carry different motor directions and connector geometry.',
      'Traffic-calming table at node 9779535787 does not itself block motor continuation.',
      'Four restriction relations distinguish approaches and turns; a point-only blocked/open flag cannot express them.',
    ],
    needs_review: 'Model the entire intersection as approach-to-departure movements, then verify the allowed corridor continuation.',
  },
  {
    id: 'manor-wilson-source-gap',
    label: 'Manor / Wilson: no blockage is encoded in the snapshot',
    coordinates: [-87.6996166, 41.9647692],
    ways: [34074519, 445330031, 445330032, 34319052].map(way),
    nodes: [4427781270, 261146285, 4427781274].map(node),
    observations: [
      'The two short Manor ways across Wilson have ordinary residential tags, no motor-access tag, no one-way tag and a shared junction node.',
      'The candidate relation list contains no relation attached to these four ways.',
      'This is a direct test location for checking whether a documented closure is missing from OSM; these tags alone cannot confirm an open through movement.',
    ],
    needs_review: 'Reconcile current Manor/Wilson closure or open-street status with project records, signage and dated ground evidence.',
  },
  {
    id: 'wood-motor-direction-changes',
    label: 'Wood: a bicycle-bidirectional greenway with southbound-only motor blocks',
    coordinates: [-87.672323, 41.9009647],
    ways: [1290364169, 1444797397, 285297142, 1444797396, 31125392].map(way),
    observations: [
      'Ways 1444797397 and 1444797396 are southbound in node order, motor-oneway=yes and oneway:bicycle=no.',
      'The city source independently lists Wood Augusta–Cortez and Division–Crystal as southbound motor / two-way bicycle / contraflow.',
      'The intervening and adjacent road pieces lack a one-way tag, so the motor-direction changes are local, not a property of the entire named street.',
      'An ordered greenway trace must preserve the permitted southbound passage through these blocks while interrupting northbound motor travel.',
    ],
    needs_review: 'Check the current design and signs at each direction-change boundary; the snapshot describes a candidate direction model, not accepted field truth.',
  },
  {
    id: 'kenmore-bollards',
    label: 'Kenmore: barrier tags live on nodes, not just way attributes',
    ways: [293388764, 814762285].map(way),
    nodes: [7613384009, 7610489575].map(node),
    observations: [
      'The only two barrier-tagged nodes found on all 715 candidate ways are bollards on Kenmore.',
      'One is bollard=removable; removability alone does not establish public motor access.',
      'These node tags are present in SQLite but absent from the exported candidate-way objects.',
    ],
    needs_review: 'Verify ordinary passenger-car access and passage width; do not infer the state from removability alone.',
  },
];
const report = {
  schema: 'greenway-data-probe-v1',
  purpose: 'Reproducible source/topology evidence for an implementation plan; no reviewed Chicago vehicle movements are asserted.',
  source_effective_date: osmSource.effective_date,
  source_sha256: osmSource.sha256,
  stats: {
    city_source_records: sources.length,
    raw_source_geometry_edges: sources.reduce((n, s) => n + s.the_geom.coordinates.reduce((n, line) => n + line.length - 1, 0), 0),
    city_geometry_intervals: matches.length,
    intervals_without_candidates: matches.filter((m) => !m.candidates.length).length,
    intervals_with_multiple_candidates: matches.filter((m) => m.candidates.length > 1).length,
    candidate_intervals_without_full_endpoint_coverage: matches.filter((m) => m.candidates.length && !m.candidates.some((w) => w.covers_both_designation_endpoints)).length,
    matching_failure_examples: matches.filter((m) => [154, 1271].includes(m.sid)).map((m) => ({
      sid: m.sid, street: m.street, length_m: m.gw_mm / 1000,
      best_candidate: m.candidates[0] ? { way_id: m.candidates[0].way_id, endpoint_distances_m: m.candidates[0].endpoint_distances_m } : null,
    })),
    interval_length_m: { min: lengths[0], median: lengths[Math.floor(lengths.length / 2)], max: lengths.at(-1), below_5m: lengths.filter((x) => x < 5).length, below_10m: lengths.filter((x) => x < 10).length, below_25m: lengths.filter((x) => x < 25).length },
    candidate_ways: candidateWays.size,
    candidate_way_oneway_tags: tally([...candidateWays.values()].map((w) => w.tags.oneway ?? '(absent)')),
    candidate_way_bicycle_contraflow: [...candidateWays.values()].filter((w) => ['yes', '1', 'true', '-1'].includes(w.tags.oneway) && w.tags['oneway:bicycle'] === 'no').length,
    source_records_bicycle_contraflow: sources.filter((s) => s.contraflow === 'Y').length,
    candidate_nodes: candidateNodes.size,
    candidate_barrier_nodes: taggedNodes.filter((n) => n.tags.barrier),
    directly_attached_restrictions: restrictions.length,
    restriction_types: tally(restrictions.map((r) => r.tags.restriction ?? '(mode-specific)')),
    scope_warning: 'These counts describe candidate matches, not accepted greenway motor roads. Absence of a restriction or barrier tag is not evidence that the movement is permitted.',
  },
  corridor_summaries: summaries,
  cases,
};
await mkdir('data/experiments', { recursive: true });
await writeFile('data/experiments/data-probe.json', JSON.stringify(report, null, 2) + '\n');
db.close();
console.log(JSON.stringify(report.stats, null, 2));
console.log('Saved data/experiments/data-probe.json');
