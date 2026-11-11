// Builds the static demo into site-dist/ from src/site and the data files.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import { render, render404 } from '../src/site/page.mjs';

const OUT = process.argv[2] || 'site-dist';
const j = f => JSON.parse(readFileSync(f, 'utf8'));
const data = { session: j('data/session.json'), verify: j('data/verify.json'), recon: j('data/recon.json'), parser: j('data/parser-eval.json'), quality: existsSync('data/quality.json') ? j('data/quality.json') : null };
rmSync(OUT, { recursive: true, force: true });
for (const d of ['fonts', 'models', 'renders', 'vendor']) mkdirSync(`${OUT}/${d}`, { recursive: true });
writeFileSync(`${OUT}/index.html`, render(data));
writeFileSync(`${OUT}/404.html`, render404());
copyFileSync('src/site/app.css', `${OUT}/app.css`);
writeFileSync(`${OUT}/robots.txt`, 'User-agent: *\nDisallow: /\n');
writeFileSync(`${OUT}/favicon.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#F3F4F1"/><path d="M6 25V9l10-4 10 4v16" fill="none" stroke="#15181C" stroke-width="2"/><path d="M5 28h22M5 26v4M27 26v4" stroke="#2A5DB0" stroke-width="1.6"/></svg>');
const F = 'node_modules/@fontsource';
for (const [pkg, file] of [['bodoni-moda', 'bodoni-moda-latin-500-normal.woff2'], ['hanken-grotesk', 'hanken-grotesk-latin-400-normal.woff2'], ['hanken-grotesk', 'hanken-grotesk-latin-600-normal.woff2'], ['martian-mono', 'martian-mono-latin-400-normal.woff2']])
  copyFileSync(`${F}/${pkg}/files/${file}`, `${OUT}/fonts/${file}`);
for (const f of readdirSync('build/models')) copyFileSync(`build/models/${f}`, `${OUT}/models/${f}`);
for (const f of readdirSync('build/renders')) copyFileSync(`build/renders/${f}`, `${OUT}/renders/${f}`);
for (const f of ['rhino3dm.module.min.js', 'rhino3dm.wasm']) copyFileSync(`node_modules/rhino3dm/${f}`, `${OUT}/vendor/${f}`);
await build({ entryPoints: ['src/site/main.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/app.js`, legalComments: 'none', logLevel: 'error' });
console.log(`built ${OUT}`);
