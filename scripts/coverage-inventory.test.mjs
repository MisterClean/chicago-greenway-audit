import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileCoverageInventory } from './coverage-inventory.mjs';

const sample = () => ({
  cityRecords: [
    { ':id': 'a', st_name: 'ALDINE', street: 'ALDINE AVE', f_street: 'CLARK', t_street: 'BROADWAY', mi_ctrline: '1.2' },
    { ':id': 'b', st_name: 'BROADWAY', street: 'BROADWAY', f_street: 'ALDINE', t_street: 'ALDINE', mi_ctrline: '0.03' },
    { ':id': 'c', st_name: 'BLOOMINDALE', street: 'BLOOMINDALE AVE', mi_ctrline: '0.5' },
    { ':id': 'd', st_name: 'BLOOMINGDALE', street: 'BLOOMINGDALE AVE', mi_ctrline: '0.25' },
    { ':id': 'e', st_name: 'AVENUE', street: 'AVENUE J', mi_ctrline: '0.1' }
  ].map(record=>({...record,displayrou:'Neighborhood Greenway'})),
  routes: [{ id: 'aldine-1', name: 'Aldine', source_ids: ['a', 'b'] }, { id: 'aldine-2', name: 'Aldine', source_ids: ['a'] }]
});

test('counts source IDs uniquely across routes, including a differently named connector', () => {
  const result = compileCoverageInventory(sample());
  assert.deepEqual(result.summary, { total_city_rows: 5, included_city_rows: 2, remaining_city_rows: 3, total_city_source_miles: 2.08, included_city_source_miles: 1.23, remaining_city_source_miles: 0.85, route_family_count: 1, route_section_count: 2, remaining_raw_street_names: 3 });
  assert.deepEqual(result.eligibility, {field:'displayrou',equals:'Neighborhood Greenway',validated_city_rows:5});
  assert.deepEqual(result.covered_rows, [{ id: 'a', route_ids: ['aldine-1', 'aldine-2'] }, { id: 'b', route_ids: ['aldine-1'] }]);
  assert.deepEqual(result.remaining_street_groups.map(g => g.st_name), ['AVENUE', 'BLOOMINDALE', 'BLOOMINGDALE']);
  assert.equal(result.remaining_rows.find(r => r.id === 'e').street, 'AVENUE J');
  const reordered = sample(); reordered.cityRecords.reverse(); reordered.routes.reverse();
  assert.deepEqual(compileCoverageInventory(reordered), result);
});

test('rejects unknown and duplicate city IDs and malformed mileage', () => {
  let value = sample(); value.routes[0].source_ids.push('missing'); assert.throws(() => compileCoverageInventory(value), /unknown city ID/);
  value = sample(); value.cityRecords.push({ ...value.cityRecords[0] }); assert.throws(() => compileCoverageInventory(value), /duplicate city ID/);
  for (const miles of ['', null, -1, 'NaN', 'Infinity']) {
    value = sample(); value.cityRecords[0].mi_ctrline = miles;
    assert.throws(() => compileCoverageInventory(value), /invalid mileage/);
  }
});

test('CLI check detects stale outputs without writing', () => {
  const root = mkdtempSync(join(tmpdir(), 'coverage-inventory-'));
  const cli = fileURLToPath(new URL('./build-coverage-inventory.mjs', import.meta.url));
  try {
    for (const dir of ['data/sources', 'data/routes', 'public/routes']) mkdirSync(join(root, dir), { recursive: true });
    const input = sample();
    const city = JSON.stringify(input.cityRecords);
    writeFileSync(join(root, 'data/sources/greenways.json'), city);
    writeFileSync(join(root, 'public/routes/pilot.json'), JSON.stringify({ routes: input.routes }));
    writeFileSync(join(root, 'data/sources/sources.json'), JSON.stringify([{ file: 'greenways.json', sha256: createHash('sha256').update(city).digest('hex') }]));
    const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    const path = join(root, 'public/routes/coverage-inventory.json');
    writeFileSync(path, 'stale\n');
    const checked = run('--check');
    assert.notEqual(checked.status, 0);
    assert.match(checked.stderr, /stale/);
    assert.equal(readFileSync(path, 'utf8'), 'stale\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rejects other bike facilities and missing category before counting coverage', () => {
  for (const category of ['Bike Lane', 'Protected Bike Lane', 'Marked Shared Lane', 'Off Street Trail', 'Proposed Neighborhood Greenway', 'neighborhood greenway', '', null, undefined]) {
    const input=sample();input.cityRecords[4].displayrou=category;
    assert.throws(()=>compileCoverageInventory(input), /outside the required Neighborhood Greenway category/);
  }
});
