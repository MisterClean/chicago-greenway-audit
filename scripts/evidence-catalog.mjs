import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const fail = message => { throw new Error(message); };
const text = (value, name, required = false) => {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string${required ? '' : ' or null'}`);
  return value;
};
// Accept explicit precision, without silently correcting impossible calendar dates.
const date = (value, name) => {
  const result = text(value, name);
  if (result === null) return null;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2}))?)?)?$/.exec(result);
  if (!match) fail(`${name} must be an ISO date or timestamp`);
  const [, y, m, d, h, min, sec, , zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || (m && (month < 1 || month > 12)) || (d && (day < 1 || day > days[month - 1])) || (h && (Number(h) > 23 || Number(min) > 59 || Number(sec) > 59)) || (zone && zone !== 'Z' && (Number(zone.slice(1,3)) > 23 || Number(zone.slice(4,6)) > 59))) fail(`${name} is not a valid calendar date or timestamp`);
  return result;
};
const url = (value, name) => {
  text(value, name, true);
  let parsed;
  try { parsed = new URL(value); } catch { fail(`${name} must be a valid HTTP(S) URL`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(`${name} must be a valid HTTP(S) URL without credentials`);
  return parsed;
};
export function canonicalSourceUrl(value) {
  const parsed = url(value, 'source URL');
  parsed.hash = '';
  return parsed.href;
}
export const sourceId = canonicalUrl => `source-${hash(canonicalUrl)}`;
const list = (value, name, check) => {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(`${name} must be an array`);
  value.forEach((item, index) => check(item, `${name}[${index}]`));
  return clone(value);
};
const bindings = record => {
  const city_rows = list(record.source_record_ids, 'source_record_ids', (v,n) => text(v,n,true));
  const way_ids = list(record.way_ids, 'way_ids', (v,n) => { if (!Number.isSafeInteger(v) || v <= 0) fail(`${n} must be a positive integer`); });
  const way_segments = list(record.way_segments, 'way_segments', (segment, n) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment) || !Number.isSafeInteger(segment.way_id) || segment.way_id <= 0 || !Array.isArray(segment.nodes) || segment.nodes.length < 2 || segment.nodes.some(node => !Number.isSafeInteger(node) || node <= 0)) fail(`${n} must have a positive way_id and at least two ordered positive node IDs`);
  });
  let gap = null;
  if (record.gap_scope != null) {
    const s = record.gap_scope;
    if (!s || typeof s !== 'object' || Array.isArray(s)) fail('gap_scope must be an object');
    text(s.route_id, 'gap_scope.route_id', true);
    const b = s.bounds;
    if (!Array.isArray(b) || b.length !== 2 || b.some(p => !Array.isArray(p) || p.length !== 2 || p.some(x => typeof x !== 'number' || !Number.isFinite(x))) || b[0][0] < -180 || b[1][0] > 180 || b[0][1] < -90 || b[1][1] > 90 || b[0][0] >= b[1][0] || b[0][1] >= b[1][1]) fail('gap_scope.bounds must be ordered longitude/latitude corners');
    gap = clone(s);
  }
  return { city_rows, way_ids, way_segments, gap };
};
function citation(source, recordId, index) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail(`record ${recordId} source ${index} must be an object`);
  const original_url = text(source.url, 'source.url', true);
  const canonical_url = canonicalSourceUrl(original_url);
  const sha256 = text(source.sha256, 'source.sha256');
  if (sha256 && !/^[a-f\d]{64}$/i.test(sha256)) fail('source.sha256 must be a SHA-256 hex digest');
  const fingerprintUrl = source.snapshot_url ?? original_url;
  url(fingerprintUrl, 'fingerprint URL');
  const content_fingerprint = sha256 ? { algorithm: 'sha256', value: sha256, url: fingerprintUrl, scope: source.snapshot_url ? 'Saved extract containing this object; not the live object page' : 'Retrieved document or dataset response' } : null;
  const rawPages = source.pages ?? source.pdf_pages;
  const pages = rawPages == null ? null : list(rawPages, 'source.pages', (p,n) => { if (!(typeof p === 'string' && p.trim()) && !(Number.isSafeInteger(p) && p > 0)) fail(`${n} must be a nonempty page label or positive integer`); });
  const status = text(source.status, 'source.status');
  const context = [status, source.date_kind].filter(Boolean).join(' ');
  // Classification is conservative: only explicitly described design is tagged as such.
  const evidence_kind = /\b(design|proposal|proposed|planned|concept)\b/i.test(context) ? 'design_or_proposal' : /\bsnapshot\b/i.test(context) ? 'snapshot' : 'other_or_unspecified';
  return { source_id: sourceId(canonical_url), original_url, title: text(source.title, 'source.title'), publisher: text(source.publisher, 'source.publisher'), source_type: text(source.source_type, 'source.source_type'), source_date: date(source.source_date, 'source.source_date'), date_kind: text(source.date_kind, 'source.date_kind'), scope: text(source.scope, 'source.scope'), status, evidence_kind, pages, sha256, content_fingerprint, retrieved_at: date(source.retrieved_at, 'source.retrieved_at'), metadata_gaps: ['title', 'publisher', 'source_type', 'source_date', 'retrieved_at', 'pages', 'sha256'].filter(k => k === 'pages' ? pages == null || pages.length === 0 : k === 'sha256' ? sha256 == null : source[k] == null), review_method: text(source.review_method, 'source.review_method'), raw: clone(source) };
}
function buildCatalog(evidence) {
  if (!evidence || typeof evidence !== 'object' || !Array.isArray(evidence.records)) fail('evidence.records must be an array');
  const seen = new Set();
  const sourceMap = new Map();
  const observations = evidence.records.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail('record must be an object');
    const id = text(record.id, 'record.id', true);
    if (seen.has(id)) fail(`duplicate record ID: ${id}`);
    seen.add(id);
    if (!Array.isArray(record.sources)) fail(`record ${id} sources must be an array`);
    const citations = record.sources.map((s,i) => {
      const c = citation(s,id,i);
      const canonical_url = canonicalSourceUrl(c.original_url);
      if (!sourceMap.has(c.source_id)) sourceMap.set(c.source_id, { id: c.source_id, canonical_url, metadata_variants: { title: [], publisher: [], source_type: [] } });
      const item = sourceMap.get(c.source_id);
      for (const key of ['title', 'publisher', 'source_type']) {
        if (c[key] == null) continue;
        let variant = item.metadata_variants[key].find(v => v.value === c[key]);
        if (!variant) { variant = { value: c[key], citations: [] }; item.metadata_variants[key].push(variant); }
        variant.citations.push({ evidence_id: id, citation_index: i });
      }
      return c;
    });
    if (record.manual_view != null) {
      if (!record.manual_view || typeof record.manual_view !== 'object' || Array.isArray(record.manual_view)) fail(`record ${id} manual_view must be an object`);
      url(record.manual_view.url, 'manual_view.url');
    }
    return { evidence_id: id, geographic_bindings: bindings(record), geographic_scope_missing: !(record.location || record.source_record_ids?.length || record.way_ids?.length || record.way_segments?.length || record.gap_scope), location: text(record.location, 'record.location'), movement: text(record.movement, 'record.movement'), assertion: text(record.source_inference, 'record.source_inference'), direction_notes: clone(record.direction_notes ?? null), review_status: text(record.review_status, 'record.review_status'), confidence: text(record.confidence, 'record.confidence'), effective_period: text(record.effective_period, 'record.effective_period'), review_needed: text(record.review_needed, 'record.review_needed'), manual_view: clone(record.manual_view ?? null), citations, raw: clone(record) };
  });
  for (const source of sourceMap.values()) {
    for (const key of ['title', 'publisher', 'source_type']) source[key] = source.metadata_variants[key].length === 1 ? source.metadata_variants[key][0].value : null;
    source.type = source.source_type;
    source.metadata_status = Object.values(source.metadata_variants).some(v => v.length > 1) ? 'conflicting' : Object.values(source.metadata_variants).every(v => v.length === 0) ? 'unknown' : 'supplied';
    source.metadata_gaps = Object.keys(source.metadata_variants).filter(k => source.metadata_variants[k].length === 0);
  }
  const searchFields = object => Object.entries(object).filter(([k]) => /search_(?:gap|attempt)/i.test(k));
  const batchSearches = (evidence.research_batches ?? []).flatMap(batch => searchFields(batch.metadata ?? {}).map(([field,value]) => ({evidence_id:null,research_batch_id:batch.id,record_ids:clone(batch.record_ids ?? []),field,value:clone(value)})));
  const catalog = { schema_version: 1, generated_from: { schema_version: evidence.schema_version ?? null, reviewed_at: evidence.reviewed_at ?? null, method: evidence.method ?? null }, sources: [...sourceMap.values()].sort((a,b) => a.id.localeCompare(b.id)), observations, search_gaps: [...searchFields(evidence).map(([field,value]) => ({ evidence_id:null, field, value:clone(value) })), ...batchSearches, ...evidence.records.flatMap(r => searchFields(r).map(([field,value]) => ({ evidence_id:r.id, field, value:clone(value) })))], raw_evidence: clone(evidence) };
  return catalog;
}
export function compileEvidenceCatalog(evidence) {
  return buildCatalog(evidence);
}
export function validateEvidenceCatalog(catalog) {
  if (!catalog || catalog.schema_version !== 1 || !catalog.raw_evidence) fail('invalid catalog structure or missing raw_evidence');
  const expected = buildCatalog(catalog.raw_evidence);
  if (!isDeepStrictEqual(catalog, expected)) fail('catalog does not match raw_evidence: observations, citations, source metadata or search gaps differ');
  return true;
}
