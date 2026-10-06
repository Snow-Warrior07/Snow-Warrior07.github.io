import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.dirname(fileURLToPath(import.meta.url));
const html = await fs.readFile(path.join(root, 'dist/index.html'), 'utf8');
const localAssets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(url => !/^[a-z][a-z0-9+.-]*:/i.test(url));
for (const asset of new Set(localAssets)) await fs.access(path.join(root, 'dist', asset));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs.');
for (const [, id] of html.matchAll(/(?:href="#|data-dialog=")([^"]+)"/g)) if (!ids.includes(id)) throw new Error(`Missing section or case study: ${id}`);
for (const [attribute, reference] of [...html.matchAll(/\b(aria-labelledby)="([^"]+)"/g)].map(match => [match[1], match[2]])) {
  for (const id of reference.split(' ')) if (!ids.includes(id)) throw new Error(`${attribute} references missing ID ${id}`);
}
execFileSync(process.execPath, ['--check', path.join(root, 'dist/app.js')]);
const manifest = JSON.parse(await fs.readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
if (manifest.static?.directory !== 'dist' || !manifest.project_id) throw new Error('Sites identity or static output is missing.');
console.log(`Portfolio validation passed: ${new Set(localAssets).size} local assets, ${ids.length} unique IDs, all section and dialog targets valid.`);
if (process.argv.includes('--links')) {
  const links = [...new Set([...html.matchAll(/href="(https:[^"]+)"/g)].map(match => match[1]))];
  const results = await Promise.all(links.map(async url => {
    try { const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) }); return { url, status: response.status }; }
    catch { return { url, status: 'unreachable' }; }
  }));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.status !== 200)) process.exitCode = 1;
}
