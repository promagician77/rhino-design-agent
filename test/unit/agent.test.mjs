import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../../src/agent/parser.js';
import { createSession, hash } from '../../src/agent/session.js';
import { TOOLS } from '../../src/agent/tools.js';
import { score } from '../../tools/eval-parser.mjs';
import { BRIEF } from '../../src/site/page.mjs';

test('tool schemas are valid strict function tools', () => {
  for (const t of TOOLS) {
    assert.equal(t.type, 'function'); assert.equal(t.strict, true);
    assert.equal(t.parameters.additionalProperties, false);
    assert.deepEqual([...t.parameters.required].sort(), Object.keys(t.parameters.properties).sort(), t.name);
  }
});

test('the five brief instructions become the expected tool calls', () => {
  const names = BRIEF.map(b => parse(b).map(c => c.name));
  assert.deepEqual(names, [['set_flooring'], ['set_wall_treatment'], ['change_dimension'], ['generate_variants'], ['render_view', 'save_version']]);
});

test('parser keeps passing the phrasings it was written against', () => {
  const fx = JSON.parse(readFileSync('test/fixtures/instructions.json', 'utf8'));
  const r = score(fx.dev);
  assert.equal(r.correct, r.total, JSON.stringify(r.rows.filter(x => !x.ok).map(x => x.text)));
});

test('nothing changes until approve; reject leaves the model as it was', () => {
  const s = createSession(); const h0 = hash(s.spec);
  const r = s.propose(parse(BRIEF[0]), BRIEF[0]);
  assert.equal(r.ready, true); assert.equal(hash(s.spec), h0);
  s.reject(); assert.equal(hash(s.spec), h0);
  s.propose(parse(BRIEF[0]), BRIEF[0]); s.approve();
  assert.equal(s.spec.flooring.plankWidth, 240);
});

test('the brief end to end: three approvals, variants, Version 2, rollback restores exact hashes', () => {
  const s = createSession();
  for (const b of BRIEF.slice(0, 3)) { const r = s.propose(parse(b), b); assert.equal(r.ready, true, b); s.approve(); }
  const v = s.variants(3);
  assert.equal(v.length, 3); assert.ok(v.every(x => x.check.ok));
  const saved = s.save('Version 2');
  const r1 = s.rollback('Version 1'); assert.equal(r1.matches, true);
  assert.equal(s.spec.wardrobe.depth, 600);
  const r2 = s.rollback('Version 2'); assert.equal(r2.matches, true);
  assert.equal(hash(s.spec), saved.hash);
});

test('a blocked change comes with the largest change that passes', () => {
  const s = createSession();
  s.propose(parse(BRIEF[2]), BRIEF[2]); s.approve();
  const r = s.propose(parse('Increase the wardrobe depth by another 300 mm.'));
  assert.equal(r.ready, false);
  assert.equal(r.suggestion.delta_mm, 30);
  const ok = s.propose(parse(`Increase the wardrobe depth by ${r.suggestion.delta_mm} mm.`));
  assert.equal(ok.ready, true);
});

test('a delete request is never turned into an action', () => {
  for (const t of ['delete everything', 'Remove the wardrobe', 'Delete the bedside tables']) assert.deepEqual(parse(t).map(c => c.name), ['ask_clarification'], t);
});
