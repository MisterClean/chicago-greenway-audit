import { parseArgs } from 'node:util';

export function parseScope(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, options: { scope: { type: 'string', default: 'city' } }, allowPositionals: true });
  if (!['city', 'ward35'].includes(values.scope)) throw new Error('Scope must be city or ward35.');
  if (positionals.length > 1) throw new Error('Pass at most one reviewed bundle directory.');
  return { scope: values.scope, bundleDirectory: positionals[0] };
}
