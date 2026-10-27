import { readFile, writeFile } from 'node:fs/promises';
import { compileEvidenceCatalog } from './evidence-catalog.mjs';

const check = process.argv.includes('--check');
const unknown = process.argv.slice(2).filter(arg => arg !== '--check');
if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
const evidence = JSON.parse(await readFile('data/routes/review-evidence.json', 'utf8'));
const output = `${JSON.stringify(compileEvidenceCatalog(evidence), null, 2)}\n`;
for (const path of ['data/routes/evidence-catalog.json', 'public/routes/evidence-catalog.json']) {
  if (check) {
    let existing;
    try { existing = await readFile(path, 'utf8'); } catch { throw new Error(`${path} is missing; rebuild the evidence catalog`); }
    if (existing !== output) throw new Error(`${path} is stale; rebuild the evidence catalog`);
  } else await writeFile(path, output);
}
console.log(check ? 'Evidence catalogs are current.' : 'Built evidence catalogs.');
