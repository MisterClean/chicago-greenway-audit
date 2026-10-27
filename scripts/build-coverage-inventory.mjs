import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { compileCoverageInventory } from './coverage-inventory.mjs';

const check = process.argv.includes('--check');
const unknown = process.argv.slice(2).filter(arg => arg !== '--check');
if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
const [cityBytes, routeBytes, manifestBytes] = await Promise.all([
  readFile('data/sources/greenways.json'), readFile('public/routes/pilot.json'), readFile('data/sources/sources.json')
]);
const manifest = JSON.parse(manifestBytes);
const sourceMetadata = manifest.find(source => source.file === 'greenways.json');
if (!sourceMetadata) throw new Error('City source metadata missing from manifest');
const cityHash = createHash('sha256').update(cityBytes).digest('hex');
if (cityHash !== sourceMetadata.sha256) throw new Error('City source hash does not match manifest');
const routeSha256 = createHash('sha256').update(routeBytes).digest('hex');
const output = `${JSON.stringify(compileCoverageInventory({ cityRecords: JSON.parse(cityBytes), routes: JSON.parse(routeBytes).routes, sourceMetadata, routeSha256 }), null, 2)}\n`;
for (const path of ['data/routes/coverage-inventory.json', 'public/routes/coverage-inventory.json']) {
  if (check) {
    let existing;
    try { existing = await readFile(path, 'utf8'); } catch { throw new Error(`${path} is missing; rebuild the coverage inventory`); }
    if (existing !== output) throw new Error(`${path} is stale; rebuild the coverage inventory`);
  } else await writeFile(path, output);
}
console.log(check ? 'Coverage inventories are current.' : 'Built coverage inventories.');
