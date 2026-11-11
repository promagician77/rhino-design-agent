import { test } from 'node:test';
import assert from 'node:assert/strict';
import rhino3dmInit from 'rhino3dm';
import { INITIAL_SPEC } from '../../src/model/spec.js';
import { to3dm } from '../../src/model/to3dm.js';
import { llmParse } from '../../src/agent/llm.js';
import { render } from '../../src/site/page.mjs';
import { readFileSync } from 'node:fs';

test('.3dm writer: millimetres, closed solids, user text and the spec inside, read back by rhino3dm', async () => {
  const rhino = await rhino3dmInit();
  const { bytes, objects } = to3dm(rhino, INITIAL_SPEC, { label: 'Version 1', note: 'test' });
  const doc = rhino.File3dm.fromByteArray(bytes);
  assert.equal(doc.objects().count, objects);
  assert.equal(doc.settings().modelUnitSystem, rhino.UnitSystem.Millimeters);
  assert.deepEqual(JSON.parse(doc.strings().getvalue('design-spec')), INITIAL_SPEC);
  const o = doc.objects().get(0);
  assert.ok(o.geometry().isSolid);
  assert.ok(o.attributes().getUserString('part'));
});

test('OpenAI adapter keeps only offered tools and parses their arguments', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.tool_choice, 'required'); assert.ok(body.tools.every(t => t.strict));
    return { ok: true, json: async () => ({ output: [
      { type: 'function_call', name: 'set_flooring', arguments: '{"material":"walnut_light","plank_width_mm":null,"plank_width_change":"wider","plank_length_mm":null}' },
      { type: 'function_call', name: 'run_python', arguments: '{"code":"import os"}' },
      { type: 'message', content: [] }], usage: { total_tokens: 900 } }) };
  };
  try {
    const r = await llmParse('walnut floor, wider planks', { apiKey: 'k', model: 'm' });
    assert.deepEqual(r.calls.map(c => c.name), ['set_flooring']);
    assert.equal(r.calls[0].arguments.plank_width_change, 'wider');
  } finally { globalThis.fetch = orig; }
});

test('page renders every number from data, without gaps', () => {
  const j = f => JSON.parse(readFileSync(f, 'utf8'));
  const html = render({ session: j('data/session.json'), verify: j('data/verify.json'), recon: j('data/recon.json'), parser: j('data/parser-eval.json'), quality: null });
  assert.doesNotMatch(html, /undefined|NaN|\[object/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  for (const f of ['Version-1.3dm', 'Version-2.3dm', 'Variant-A.3dm']) assert.ok(html.includes(`models/${f}`));
});
