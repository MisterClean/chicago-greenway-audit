export type Direction = 'forward' | 'reverse';
export type DirectionView = Direction | 'both';
export type Coordinate = [number, number];
export type Geometry = { type: 'LineString'; coordinates: Coordinate[] } | { type: 'MultiLineString'; coordinates: Coordinate[][] };
export type Status = 'allowed' | 'blocked' | 'unknown';
export type DecisionKind = 'open' | 'direction' | 'access' | 'physical' | 'unknown';
export type EvidenceStatus = 'source-inferred' | 'reviewed' | 'conflicting';

export interface Decision {
  status: Status;
  reason: string;
  kind: DecisionKind;
  evidence_status: EvidenceStatus;
  source_ids?: string[];
}
export interface Boundary {
  kind: 'blocked' | 'unknown' | 'scope_end';
  reason: string;
  coordinate?: Coordinate;
  sources?: string[];
}
export interface Edge {
  id: string;
  way_id: number | null;
  from_node: number | null;
  to_node: number | null;
  length_m: number;
  geometry: Geometry;
  access: Record<Direction, Decision>;
  evidence_urls: string[];
  role: string;
}
export interface Movement {
  id: string;
  coordinate: Coordinate;
  from_edge: string;
  to_edge: string;
  forward: Decision;
  reverse: Decision;
  evidence_urls: string[];
  cross_street: string | null;
}
export interface Run {
  id: string;
  direction: Direction;
  edge_ids: string[];
  length_m: number;
  start: Boundary;
  end: Boundary;
  complete_within_route: boolean;
  scope_limited: boolean;
  geometry: Geometry;
  evidence_status: EvidenceStatus;
}
export interface Event extends Decision {
  id: string;
  coordinate: Coordinate;
  direction: Direction;
  evidence_urls: string[];
}
export interface Route {
  id: string;
  name: string;
  extent_label: string;
  direction_labels: Record<Direction, string>;
  source_ids: string[];
  bounds: [Coordinate, Coordinate];
  geometry: Geometry;
  edges: Edge[];
  movements: Movement[];
  runs: Run[];
  events: Event[];
  coverage: { designated_m: number; matched_m: number; unknown_m: number; reviewed_movements: number; total_movements: number };
}
export interface RouteData {
  schema_version: number;
  generated_at: string;
  source: { osm_date: string; designation_date: string; osm_sha256: string; osm_attribution: string; designation_attribution: string; designation_url: string };
  routes: Route[];
}

export function distanceLabel(meters: number): string {
  if (meters > 0 && meters / 1609.344 < 0.01) return '<0.01 mi';
  return `${(meters / 1609.344).toFixed(2)} mi`;
}

export function longestRun(route: Route, direction: Direction): Run | undefined {
  return route.runs.filter(run => run.direction === direction).reduce<Run | undefined>(
    (longest, run) => !longest || run.length_m > longest.length_m ? run : longest, undefined,
  );
}

export function boundaryTitle(boundary: Boundary): string {
  if (boundary.kind === 'scope_end') return 'End of mapped greenway';
  if (boundary.kind === 'unknown') return 'Continuation unknown';
  return 'Car continuation blocked';
}

export interface RemainingDistance {
  remaining_m: number;
  coordinate: Coordinate;
  offset_m: number;
  distance_to_line_m: number;
}
const earthRadiusM = 6371008.8;
const radians = Math.PI / 180;
function haversine(a: Coordinate, b: Coordinate): number {
  const lat1 = a[1] * radians, lat2 = b[1] * radians;
  const dLat = lat2 - lat1, dLon = (b[0] - a[0]) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(Math.min(1, h)));
}

// A keyboard-accessible position control uses the same oriented polyline as
// click projection. Disconnected parts never contribute imaginary distance.
export function coordinateAtFraction(run: Run, fraction: number): Coordinate | undefined {
  const parts = run.geometry.type === 'LineString' ? [run.geometry.coordinates] : run.geometry.coordinates;
  const segments = parts.flatMap(part => part.slice(1).map((end, i) => ({
    start: part[i], end, length: haversine(part[i], end),
  }))).filter(segment => segment.length > 0);
  if (!segments.length || !Number.isFinite(fraction)) return undefined;
  let remaining = segments.reduce((sum, segment) => sum + segment.length, 0) * Math.max(0, Math.min(1, fraction));
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const t = remaining / segment.length;
      return [segment.start[0] + t * (segment.end[0] - segment.start[0]), segment.start[1] + t * (segment.end[1] - segment.start[1])];
    }
    remaining -= segment.length;
  }
  return segments.at(-1)!.end;
}

// Run geometry is already ordered in the run's direction. Distances are scaled
// to its authoritative length; separate MultiLineString parts have no connector.
export function remainingDistance(run: Run, clickCoordinate: Coordinate): RemainingDistance | undefined {
  const lines = run.geometry.type === 'LineString' ? [run.geometry.coordinates] : run.geometry.coordinates;
  let total = 0;
  let bestDistance = Infinity;
  let bestOffset = 0;
  let bestCoordinate: Coordinate | undefined;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const segmentLength = haversine(a, b);
      const latScale = earthRadiusM * radians;
      const lonScale = latScale * Math.cos(clickCoordinate[1] * radians);
      const ax = (a[0] - clickCoordinate[0]) * lonScale, ay = (a[1] - clickCoordinate[1]) * latScale;
      const dx = (b[0] - a[0]) * lonScale, dy = (b[1] - a[1]) * latScale;
      const denominator = dx * dx + dy * dy;
      const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
      const candidate: Coordinate = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      const distance = haversine(clickCoordinate, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = total + t * segmentLength;
        bestCoordinate = candidate;
      }
      total += segmentLength;
    }
  }
  if (!bestCoordinate || total <= 0) return undefined;
  const offset = run.length_m * bestOffset / total;
  return { remaining_m: Math.max(0, run.length_m - offset), offset_m: offset, coordinate: bestCoordinate, distance_to_line_m: bestDistance };
}
