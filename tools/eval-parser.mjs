// Scores the offline instruction parser on the fixture set. Usage: node tools/eval-parser.mjs [dev|holdout|all] [--write]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse } from '../src/agent/parser.js';

export function matches(calls, expect) {
  if (calls.length !== expect.length) return false;
  return expect.every((e, i) => calls[i].name === e.name && Object.entries(e.args || {}).every(([k, v]) => calls[i].arguments[k] === v));
}

export function score(items, run = parse) {
  const rows = items.map(it => {
    const calls = run(it.text);
    const ok = matches(calls, it.expect);
    // Failure kinds: 'asked' = a question instead of an action (safe), 'partial' = every action taken was expected
    // but some were missed, 'wrong' = an action nobody asked for (it still needs approval and passes the checks).
    const kind = ok ? null : calls.every(c => c.name === 'ask_clarification') ? 'asked'
      : calls.every(c => it.expect.some(e => matches([c], [e]))) ? 'partial' : 'wrong';
    return { text: it.text, ok, kind, expected: it.expect, got: calls.map(c => c.name + ' ' + JSON.stringify(c.arguments)) };
  });
  const kinds = {};
  for (const r of rows) if (r.kind) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  return { total: rows.length, correct: rows.filter(r => r.ok).length, kinds, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fx = JSON.parse(readFileSync('test/fixtures/instructions.json', 'utf8'));
  const which = process.argv[2] || 'all';
  const out = {};
  for (const set of ['dev', 'holdout']) {
    if (which !== 'all' && which !== set) continue;
    const r = score(fx[set]);
    out[set] = { total: r.total, correct: r.correct, kinds: r.kinds, failures: r.rows.filter(x => !x.ok) };
    console.log(`${set}: ${r.correct}/${r.total}`, r.kinds);
    for (const f of r.rows.filter(x => !x.ok)) console.log('  FAIL', f.text, '\n     ', f.got.join(' | '));
  }
  if (process.argv.includes('--write')) {
    out.history = fx.history; mkdirSync('data', { recursive: true }); writeFileSync('data/parser-eval.json', JSON.stringify(out, null, 2)); }
}
