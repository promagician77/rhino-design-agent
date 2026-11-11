import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SPEC } from '../../src/model/spec.js';
import { generate } from '../../src/model/generate.js';
import { TEST_CAMERA, project, vanishingPoint, clickPlan, reconstruct, dimensions, truthDimensions } from '../../src/recon/metrology.js';

const gen = generate(INITIAL_SPEC), plan = clickPlan(INITIAL_SPEC, gen);
const clicks = (cam) => {
  const P = x => project(cam, x).slice(0, 2);
  const m = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, P(v)]));
  return { linesX: plan.linesX.map(([a, b]) => [P(a), P(b)]), linesY: plan.linesY.map(([a, b]) => [P(a), P(b)]), origin: P(plan.origin), originTop: P(plan.originTop),
    floor: m(plan.floor), ceiling: m(plan.ceiling), zmm: plan.zmm, verticals: Object.fromEntries(Object.entries(plan.verticals).map(([k, [a, b]]) => [k, [P(a), P(b)]])) };
};
const size = { width: TEST_CAMERA.width, height: TEST_CAMERA.height };

test('vanishing point of exact parallel edges is exact', () => {
  const vp = vanishingPoint(plan.linesX.map(([a, b]) => [project(TEST_CAMERA, a), project(TEST_CAMERA, b)]));
  const far = project(TEST_CAMERA, [1e9, plan.origin[1], TEST_CAMERA.pos[2]]);
  assert.ok(Math.hypot(vp[0] - far[0], vp[1] - far[1]) < 0.01);
});

test('without click error every dimension and the lens come back exactly', () => {
  const r = reconstruct(clicks(TEST_CAMERA), { ceilingHeight: 2900 }, size);
  assert.ok(Math.abs(r.fovV - TEST_CAMERA.fovV) < 1e-6);
  const d = dimensions(r), t = truthDimensions(INITIAL_SPEC, gen);
  for (const k of Object.keys(t)) assert.ok(Math.abs(d[k] - t[k]) < 1e-6, k);
});

test('lens shift: the horizon option recovers it, the image-centre assumption does not', () => {
  const cam = { ...TEST_CAMERA, shiftY: 120 };
  const t = truthDimensions(INITIAL_SPEC, gen);
  const good = dimensions(reconstruct(clicks(cam), { ceilingHeight: 2900 }, size, { principal: 'horizon' }));
  const bad = dimensions(reconstruct(clicks(cam), { ceilingHeight: 2900 }, size, { principal: 'centre' }));
  assert.ok(Math.abs(good['Room width (wall to wall)'] - t['Room width (wall to wall)']) < 1e-6);
  assert.ok(Math.abs(bad['Room width (wall to wall)'] - t['Room width (wall to wall)']) > 100);
});
