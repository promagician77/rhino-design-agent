// Renders preview images of every saved version and option with the site's own three.js viewer (headless Chromium).
// Output: build/renders/*.webp. The Version 1 hero image is the stand-in "client rendering" used by the Phase 1 test.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createSession } from '../src/agent/session.js';

const s = JSON.parse(readFileSync('data/session.json', 'utf8'));
mkdirSync('build/renders', { recursive: true });
await build({ entryPoints: ['tools/render/entry.js'], bundle: true, format: 'iife', outfile: 'build/render/entry.js', logLevel: 'error' });
writeFileSync('build/render/index.html', '<!doctype html><body style="margin:0"><canvas width="1600" height="1000" style="width:1600px;height:1000px"></canvas><script src="entry.js"></script>');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto('file://' + process.cwd() + '/build/render/index.html');
await page.waitForFunction(() => window.ready);

// Rebuild the specs for each file from the session transcript (the same specs written into the .3dm files).
const sess = createSession();
const specs = { 'Version-1': sess.spec };
const { parse } = await import('../src/agent/parser.js');
for (const t of s.turns.slice(0, 3)) { sess.propose(parse(t.text), t.text); sess.approve(); }
specs['Version-2'] = sess.spec;
for (const v of sess.variants(3)) specs[`Variant-${v.key}`] = v.spec;

const jobs = [
  ['Version-1', 'hero', 1600, 1000], ['Version-2', 'hero', 1600, 1000], ['Version-2', 'bed', 1200, 800], ['Version-2', 'wardrobe', 1200, 800], ['Version-2', 'plan', 1000, 1000],
  ['Version-1', 'bed', 1200, 800], ['Version-1', 'wardrobe', 1200, 800],
  ['Variant-A', 'bed', 900, 600], ['Variant-B', 'bed', 900, 600], ['Variant-C', 'bed', 900, 600],
];
for (const [name, view, w, h] of jobs) {
  const t0 = Date.now();
  const url = await page.evaluate(([spec, view, w, h]) => window.renderSpec(spec, view, w, h), [specs[name], view, w, h]);
  writeFileSync(`build/renders/${name}-${view}.webp`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(name, view, `${w}x${h}`, Date.now() - t0, 'ms');
}
await browser.close();
