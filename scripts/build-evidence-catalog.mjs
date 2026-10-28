import { readFile, writeFile } from 'node:fs/promises';
import { compileEvidenceCatalog } from './evidence-catalog.mjs';

const check = process.argv.includes('--check');
const unknown = process.argv.slice(2).filter(arg => arg !== '--check');
if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
const input = await readFile('data/routes/review-evidence.json');
const evidence = JSON.parse(input.toString('utf8'));
const catalog = Buffer.from(`${JSON.stringify(compileEvidenceCatalog(evidence), null, 2)}\n`);
const outputs = [
  ['data/routes/evidence-catalog.json', catalog],
  ['public/routes/evidence-catalog.json', catalog],
  ['public/routes/review-evidence.json', input],
];
for (const [path, expected] of outputs) {
  if (check) {
    let existing;
    try { existing = await readFile(path); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      throw new Error(`${path} is missing; rebuild the evidence catalog`);
    }
    if (!existing.equals(expected)) throw new Error(`${path} is stale; rebuild the evidence catalog`);
  } else await writeFile(path, expected);
}
console.log(check ? 'Evidence catalogs and public review copy are current.' : 'Built evidence catalogs and public review copy.');
