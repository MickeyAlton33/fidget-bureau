#!/usr/bin/env node
/* Assembles dist/index.html from shell.html + runtime.js + fidgets/*.js.
   Validates the collection: unique n 1..50, unique ids, category counts. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const shell = fs.readFileSync(path.join(root, 'shell.html'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'runtime.js'), 'utf8');

const dir = process.env.FIDGETS_DIR ? path.resolve(process.env.FIDGETS_DIR) : path.join(root, 'fidgets');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();

const seenN = new Map();
const seenId = new Map();
const cats = {};
let combined = '';
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const mN = src.match(/\bn:\s*(\d+)/);
  const mId = src.match(/\bid:\s*['"]([a-z0-9-]+)['"]/);
  const mCat = src.match(/\bcat:\s*['"]([a-z]+)['"]/);
  if (!mN || !mId || !mCat) { console.error(`SKIP ${f}: cannot parse n/id/cat`); process.exitCode = 1; continue; }
  const n = Number(mN[1]);
  if (seenN.has(n)) { console.error(`DUPLICATE n=${n}: ${f} vs ${seenN.get(n)}`); process.exitCode = 1; }
  if (seenId.has(mId[1])) { console.error(`DUPLICATE id=${mId[1]}: ${f} vs ${seenId.get(mId[1])}`); process.exitCode = 1; }
  seenN.set(n, f);
  seenId.set(mId[1], f);
  cats[mCat[1]] = (cats[mCat[1]] || 0) + 1;
  combined += `\n/* --- ${f} --- */\n;(() => {\n` + src.trim() + '\n})();\n';
}

for (let i = 1; i <= 50; i++) if (!seenN.has(i)) console.error(`MISSING n=${i}`);

const out = shell
  .replace('/*__RUNTIME__*/', () => runtime)
  .replace('/*__FIDGETS__*/', () => combined);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
// artifact.html: content-only (the Artifact publisher wraps it in doctype/head/body)
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), out);
// index.html: standalone for local viewing — doctype avoids Quirks Mode
const standalone = '<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + out;
fs.writeFileSync(path.join(root, 'dist', 'index.html'), standalone);
// docs/index.html: what GitHub Pages serves (Pages source = main branch /docs).
// .nojekyll stops Pages from running the file through Jekyll.
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'index.html'), standalone);
fs.writeFileSync(path.join(root, 'docs', '.nojekyll'), '');
console.log(`Built dist/index.html + dist/artifact.html + docs/index.html — ${files.length} fidgets, ${(out.length / 1024).toFixed(0)} KB`);
console.log('Categories:', JSON.stringify(cats));
