// City-row representation is a coverage inventory, not field verification.
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const milesSum = rows => Number(rows.reduce((sum, row) => sum + row.miles, 0).toFixed(12));
const requiredString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty string`);
  return value;
};

export function compileCoverageInventory({ cityRecords, routes, sourceMetadata = null, routeSha256 = null }) {
  if (!Array.isArray(cityRecords) || !Array.isArray(routes)) throw new Error('cityRecords and routes must be arrays');
  const city = new Map();
  for (const record of cityRecords) {
    const id = requiredString(record[':id'], 'city ID');
    if (city.has(id)) throw new Error(`duplicate city ID: ${id}`);
    const rawMiles = record.mi_ctrline;
    if ((typeof rawMiles !== 'string' && typeof rawMiles !== 'number') || String(rawMiles).trim() === '' || !Number.isFinite(Number(rawMiles)) || Number(rawMiles) < 0) {
      throw new Error(`invalid mileage for city ID ${id}`);
    }
    city.set(id, { id, st_name: requiredString(record.st_name, `st_name for ${id}`), street: record.street ?? null, from: record.f_street ?? null, to: record.t_street ?? null, miles: Number(rawMiles) });
  }
  const included = new Map();
  const routeIds = new Set();
  const routeNames = new Set();
  for (const route of routes) {
    const id = requiredString(route.id, 'route ID');
    if (routeIds.has(id)) throw new Error(`duplicate route ID: ${id}`);
    routeIds.add(id);
    routeNames.add(requiredString(route.name, `route name for ${id}`));
    if (!Array.isArray(route.source_ids)) throw new Error(`source_ids must be an array for route ${id}`);
    for (const sourceId of route.source_ids) {
      if (!city.has(sourceId)) throw new Error(`unknown city ID ${sourceId} in route ${id}`);
      if (!included.has(sourceId)) included.set(sourceId, new Set());
      included.get(sourceId).add(id);
    }
  }
  const all = [...city.values()].sort((a, b) => compare(a.id, b.id));
  const represented = all.filter(row => included.has(row.id));
  const remaining = all.filter(row => !included.has(row.id));
  const groups = new Map();
  for (const row of remaining) {
    if (!groups.has(row.st_name)) groups.set(row.st_name, []);
    groups.get(row.st_name).push(row);
  }
  return {
    schema_version: 1,
    description: 'City source-row representation in the route export; not a count of distinct greenway projects or field-verified routes. Mileage sums city mi_ctrline attributes, not route geometry or driving distance.',
    source: { city: sourceMetadata, route_sha256: routeSha256 },
    summary: {
      total_city_rows: all.length,
      included_city_rows: represented.length,
      remaining_city_rows: remaining.length,
      total_city_source_miles: milesSum(all),
      included_city_source_miles: milesSum(represented),
      remaining_city_source_miles: milesSum(remaining),
      route_family_count: routeNames.size,
      route_section_count: routes.length,
      remaining_raw_street_names: groups.size
    },
    covered_rows: represented.map(row => ({ id: row.id, route_ids: [...included.get(row.id)].sort(compare) })),
    remaining_street_groups: [...groups.entries()].sort(([a], [b]) => compare(a, b)).map(([st_name, rows]) => ({ st_name, row_count: rows.length, city_source_miles: milesSum(rows), source_ids: rows.map(row => row.id) })),
    remaining_rows: remaining
  };
}
