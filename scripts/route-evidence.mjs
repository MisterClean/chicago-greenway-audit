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
