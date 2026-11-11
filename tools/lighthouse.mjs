// Lighthouse, median of 3 runs, served locally with Brotli (as Vercel serves). Writes data/lighthouse.json.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { serve } from './serve.mjs';
const run = promisify(execFile);
mkdirSync('.lh', { recursive: true });
const SANDBOX_CHROME = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const env = { ...process.env, ...(process.env.CHROME_PATH || existsSync(SANDBOX_CHROME) ? { CHROME_PATH: process.env.CHROME_PATH || SANDBOX_CHROME } : {}) };
const RUNS = 3;
const s = await serve('site-dist', 4197);
const rows = [];
for (const form of ['mobile', 'desktop']) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const file = `.lh/home-${form}-${i}.json`;
    const args = ['http://localhost:4197/', '--quiet', '--output=json', `--output-path=${file}`, '--chrome-flags=--headless=new --no-sandbox --disable-gpu', '--only-categories=performance,accessibility,best-practices,seo'];
    if (form === 'desktop') args.push('--preset=desktop');
    await run('node_modules/.bin/lighthouse', args, { env, maxBuffer: 1 << 26 });
    runs.push(JSON.parse(readFileSync(file, 'utf8')));
  }
  runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
  const r = runs[1];
  const sc = k => Math.round(r.categories[k].score * 100);
  const a = k => r.audits[k].numericValue;
  rows.push({ form, perf: sc('performance'), a11y: sc('accessibility'), bp: sc('best-practices'), seo: sc('seo'), lcp: Math.round(a('largest-contentful-paint')), cls: +a('cumulative-layout-shift').toFixed(3), tbt: Math.round(a('total-blocking-time')), kb: Math.round(a('total-byte-weight') / 1024), seoFails: r.categories.seo.auditRefs.filter(x => x.weight && r.audits[x.id].score === 0).map(x => x.id) });
  console.log(JSON.stringify(rows.at(-1)));
}
await s.close();
const v = JSON.parse(readFileSync('node_modules/lighthouse/package.json', 'utf8')).version;
writeFileSync('data/lighthouse.json', JSON.stringify({ version: v, runs: RUNS, rows }, null, 1));
