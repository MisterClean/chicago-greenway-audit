import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileEvidenceCatalog, validateEvidenceCatalog } from './evidence-catalog.mjs';

const sample = () => ({ schema_version: 1, arbitrary: { keep: true }, search_attempts: [{ query: 'plans', outcome: 'none' }], records: [
  { id: 'a', way_ids: [17], way_segments: [{ way_id: 18, nodes: [23, 24] }], source_record_ids: ['row-1'], gap_scope: { route_id: 'r', bounds: [[-88,41],[-87,42]] }, source_inference: 'An inferred claim', search_gap: 'No field survey', sources: [
    { url: 'https://example.org/plan.pdf#page=1', title: 'Plan A', publisher: 'City', source_type: 'PDF', source_date: '2020', date_kind: 'publication', scope: 'design', status: 'design proposal', pages: ['1'], sha256: 'a'.repeat(64), extra: { retain: 1 } },
    { url: 'https://example.org/plan.pdf#page=2', title: 'Plan B', publisher: 'City', source_type: 'PDF', source_date: '2021-02', date_kind: 'revision', scope: 'another claim', status: 'snapshot', pdf_pages: [2], sha256: 'b'.repeat(64) }
  ] },
  { id: 'b', location: 'A crossing', source_inference: 'Another claim', sources: [{ url:'https://example.org/page', source_date:'2020-02-29T13:45:00Z' }] }
] });
test('preserves raw input, fragments, conflicting values, versions and provenance', () => {
  const input = sample();
  const result = compileEvidenceCatalog(input);
  assert.equal(result.sources.length, 2);
  const source = result.sources.find(s => s.canonical_url.endsWith('plan.pdf'));
  assert.equal(source.title, null);
  assert.equal(source.publisher, 'City');
  assert.equal(source.source_type, 'PDF');
  assert.equal(source.metadata_status, 'conflicting');
  assert.deepEqual(source.metadata_variants.title, [
    { value:'Plan A', citations:[{ evidence_id:'a', citation_index:0 }] },
    { value:'Plan B', citations:[{ evidence_id:'a', citation_index:1 }] }
  ]);
  assert.deepEqual(source.metadata_variants.publisher[0].citations, [{ evidence_id:'a', citation_index:0 }, { evidence_id:'a', citation_index:1 }]);
  const citations = result.observations[0].citations;
  assert.deepEqual(citations.map(c => c.source_date), ['2020','2021-02']);
  assert.deepEqual(citations.map(c => c.sha256), ['a'.repeat(64),'b'.repeat(64)]);
  assert.deepEqual(citations.map(c => c.pages), [['1'],[2]]);
  assert.deepEqual(citations.map(c => c.evidence_kind), ['design_or_proposal','snapshot']);
  assert.equal(citations[1].original_url, 'https://example.org/plan.pdf#page=2');
  assert.deepEqual(result.raw_evidence, input);
  assert.deepEqual(citations[0].raw, input.records[0].sources[0]);
  assert.deepEqual(result.search_gaps.map(g => g.field), ['search_attempts','search_gap']);
  assert.ok(result.observations[1].citations[0].metadata_gaps.includes('sha256'));
  assert.equal(validateEvidenceCatalog(result), true);
});
test('rejects invalid dates, duplicate IDs, URLs, hashes and bounds', () => {
  for (const invalid of ['2021-02-29','2020-13','2024-04-31','2024-01-01T24:00:00Z','yesterday']) {
    const v = sample(); v.records[0].sources[0].source_date = invalid;
    assert.throws(() => compileEvidenceCatalog(v), /source_date/);
  }
  let v = sample(); v.records.push(structuredClone(v.records[0])); assert.throws(() => compileEvidenceCatalog(v), /duplicate record/);
  v = sample(); v.records[0].sources[0].url = 'file:///x'; assert.throws(() => compileEvidenceCatalog(v), /HTTP/);
  v = sample(); v.records[0].sources[0].sha256 = 'wrong'; assert.throws(() => compileEvidenceCatalog(v), /SHA-256/);
  v = sample(); v.records[0].gap_scope.bounds = [[-87,42],[-88,41]]; assert.throws(() => compileEvidenceCatalog(v), /bounds/);
  v = sample(); v.records[0].way_segments[0].nodes = [23, 0]; assert.throws(() => compileEvidenceCatalog(v), /way_segments/);
  v = sample(); v.records[0].sources[0].scope = []; assert.throws(() => compileEvidenceCatalog(v), /scope/);
});
test('validation rejects dropped observations and tampering across the derived catalog', () => {
  for (const mutate of [
    v => v.observations.pop(),
    v => { v.observations[0].geographic_bindings.way_ids = []; },
    v => { v.observations[0].citations[0].scope = 'different'; },
    v => { v.observations[0].confidence = 'different'; },
    v => { v.sources[0].publisher = 'different'; },
    v => { v.search_gaps.pop(); },
    v => { v.raw_evidence.records[0].source_inference = 'changed'; }
  ]) {
    const v = compileEvidenceCatalog(sample()); mutate(v);
    assert.throws(() => validateEvidenceCatalog(v), /raw_evidence/);
  }
});
test('batch-wide search gaps remain discoverable with their original scope and record bindings', () => {
  const input = sample();
  input.research_batches = [{id:'batch',record_ids:['a','b'],metadata:{search_gaps:[{scope:'two wards',outcome:'No detailed plan located'}]}}];
  const catalog = compileEvidenceCatalog(input);
  assert.deepEqual(catalog.search_gaps.find(g => g.research_batch_id === 'batch'), {
    evidence_id:null,research_batch_id:'batch',record_ids:['a','b'],field:'search_gaps',value:input.research_batches[0].metadata.search_gaps,
  });
  catalog.search_gaps = catalog.search_gaps.filter(g => g.research_batch_id !== 'batch');
  assert.throws(() => validateEvidenceCatalog(catalog), /search gaps differ/);
});
test('CLI check catches a stale output without changing it', () => {
  const root = mkdtempSync(join(tmpdir(), 'catalog-test-'));
  try {
    mkdirSync(join(root,'data/routes'), { recursive:true }); mkdirSync(join(root,'public/routes'), { recursive:true });
    writeFileSync(join(root,'data/routes/review-evidence.json'), JSON.stringify(sample()));
    const cli = fileURLToPath(new URL('./build-evidence-catalog.mjs', import.meta.url));
    const run = (...args) => spawnSync(process.execPath, [cli,...args], { cwd:root, encoding:'utf8' });
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    const target = join(root,'public/routes/evidence-catalog.json');
    writeFileSync(target, 'stale');
    const check = run('--check');
    assert.notEqual(check.status, 0); assert.match(check.stderr, /stale/);
    assert.equal(readFileSync(target,'utf8'), 'stale');
  } finally { rmSync(root, { recursive:true, force:true }); }
});

test('an OSM object citation identifies the saved extract that its checksum covers', () => {
  const input = sample();
  const source = input.records[0].sources[0];
  source.url = 'https://www.openstreetmap.org/way/17';
  source.snapshot_url = 'https://example.org/chicago.osm.pbf';
  const catalog = compileEvidenceCatalog(input);
  const cited = catalog.observations[0].citations[0];
  assert.equal(cited.original_url, source.url);
  assert.equal(cited.content_fingerprint.url, source.snapshot_url);
  assert.match(cited.content_fingerprint.scope, /not the live object page/);
  assert.equal(cited.content_fingerprint.value, source.sha256);
  source.snapshot_url = 'file:///private/extract';
  assert.throws(() => compileEvidenceCatalog(input), /HTTP/);
});
