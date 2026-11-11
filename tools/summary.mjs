// Runs every test suite and collects the results with the axe and Lighthouse files into data/quality.json,
// which the page and the README read. Usage: node tools/summary.mjs [--skip-e2e]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 }); return (r.stdout || '') + (r.stderr || ''); };
const tap = out => ({ passed: +(out.match(/# pass (\d+)/)?.[1] || 0), failed: +(out.match(/# fail (\d+)/)?.[1] || 0) });

const unit = tap(run('node', ['--test', 'test/unit/model.test.mjs', 'test/unit/agent.test.mjs', 'test/unit/files.test.mjs', 'test/unit/recon.test.mjs']));
const py = run('python3', ['rhino/test_rhino_side.py']);
const python = { passed: +(py.match(/Ran (\d+) tests/)?.[1] || 0) - (py.includes('FAILED') ? +(py.match(/failures=(\d+)/)?.[1] || 0) + +(py.match(/errors=(\d+)/)?.[1] || 0) : 0), failed: py.includes('FAILED') ? 1 : 0 };
const old = existsSync('data/quality.json') ? JSON.parse(readFileSync('data/quality.json', 'utf8')) : {};
const e2e = process.argv.includes('--skip-e2e') ? old.e2e : tap(run('node', ['--test', 'test/e2e/site.test.cjs']));
const axe = JSON.parse(readFileSync('data/axe.json', 'utf8'));
const lh = existsSync('data/lighthouse.json') ? JSON.parse(readFileSync('data/lighthouse.json', 'utf8')) : null;
const lm = lh?.rows.find(r => r.form === 'mobile'), ld = lh?.rows.find(r => r.form === 'desktop');
const out = {
  unit, python, e2e,
  axe: { violations: axe.issues.filter(i => i.kind === 'axe').length, otherIssues: axe.issues.filter(i => i.kind !== 'axe').length, scans: axe.runs, minContrast: axe.minContrast },
  lighthouse: lm && { performance: lm.perf, accessibility: lm.a11y, bestPractices: lm.bp, seo: lm.seo, lcpMs: lm.lcp, cls: lm.cls, tbtMs: lm.tbt, kb: lm.kb, desktop: ld, version: lh.version },
};
writeFileSync('data/quality.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
if (unit.failed || python.failed || e2e?.failed) process.exit(1);
