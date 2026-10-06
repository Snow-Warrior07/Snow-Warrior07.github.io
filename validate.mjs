import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
async function htmlFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(filename));
    else if (entry.name.endsWith('.html')) files.push(filename);
  }
  return files;
}
const pages = new Map();
for (const filename of await htmlFiles(dist)) {
  const html = await fs.readFile(filename, 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate HTML IDs in ${path.relative(dist, filename)}.`);
  pages.set(filename, { html, ids: new Set(ids) });
}
const localTargets = new Set();
for (const [filename, { html, ids }] of pages) {
  const relativeFile = path.relative(dist, filename).split(path.sep).join('/');
  const base = `https://portfolio.local/${relativeFile}`;
  for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) continue;
    const url = new URL(reference, base);
    let target = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
    const relativeTarget = path.relative(dist, target);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) throw new Error(`Local link escapes website: ${reference}`);
    if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
    await fs.access(target);
    localTargets.add(target);
    if (url.hash && pages.has(target) && !pages.get(target).ids.has(decodeURIComponent(url.hash.slice(1)))) {
      throw new Error(`Missing anchor from ${relativeFile}: ${reference}`);
    }
  }
  for (const [, id] of html.matchAll(/data-dialog="([^"]+)"/g)) {
    if (!ids.has(id)) throw new Error(`Missing case study in ${relativeFile}: ${id}`);
  }
  for (const [, attribute, references] of html.matchAll(/\b(aria-labelledby|aria-describedby)="([^"]+)"/g)) {
    for (const id of references.split(' ')) if (!ids.has(id)) throw new Error(`${attribute} references missing ID ${id} in ${relativeFile}`);
  }
}
execFileSync(process.execPath, ['--check', path.join(root, 'dist/app.js')]);
const manifest = JSON.parse(await fs.readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
if (manifest.static?.directory !== 'dist' || !manifest.project_id) throw new Error('Sites identity or static output is missing.');
const totalIds = [...pages.values()].reduce((sum, page) => sum + page.ids.size, 0);
console.log(`Portfolio validation passed: ${pages.size} HTML pages, ${localTargets.size} local targets, ${totalIds} IDs; cross-page anchors and dialogs valid.`);
if (process.argv.includes('--links')) {
  const links = [...new Set([...pages.values()].flatMap(({ html }) => [...html.matchAll(/href="(https:[^"]+)"/g)].map(match => match[1])))];
  const results = await Promise.all(links.map(async url => {
    try { const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) }); return { url, status: response.status }; }
    catch { return { url, status: 'unreachable' }; }
  }));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.status !== 200)) process.exitCode = 1;
}
