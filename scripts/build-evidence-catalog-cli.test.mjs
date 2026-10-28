import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('CLI detects and repairs a stale public review copy without changing the source', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-copy-'));
  try {
    mkdirSync(join(root, 'data/routes'), {recursive:true});
    mkdirSync(join(root, 'public/routes'), {recursive:true});
    // Deliberately retain unusual formatting and CRLF to test byte fidelity.
    const input = Buffer.from('{\r\n  "schema_version": 1, "records": []\r\n}\r\n');
    const source = join(root, 'data/routes/review-evidence.json');
    const copy = join(root, 'public/routes/review-evidence.json');
    const catalogs = ['data/routes/evidence-catalog.json', 'public/routes/evidence-catalog.json'].map(p => join(root,p));
    const cli = fileURLToPath(new URL('./build-evidence-catalog.mjs', import.meta.url));
    const run = (...args) => spawnSync(process.execPath, [cli,...args], {cwd:root, encoding:'utf8'});
    writeFileSync(source,input);
    assert.equal(run().status,0);
    assert.deepEqual(readFileSync(copy),input);
    const before = catalogs.map(p=>readFileSync(p));
    writeFileSync(copy, '{"schema_version":1,"records":[]}\n');
    const result=run('--check');
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/public\/routes\/review-evidence\.json is stale/);
    assert.deepEqual(catalogs.map(p=>readFileSync(p)),before);
    assert.equal(run().status,0);
    assert.deepEqual(readFileSync(copy),input);
    assert.deepEqual(readFileSync(source),input);
    assert.equal(run('--check').status,0);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
