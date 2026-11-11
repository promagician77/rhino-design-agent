import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SPEC, clone } from '../../src/model/spec.js';
import { generate } from '../../src/model/generate.js';
import { check } from '../../src/model/checks.js';
import { applyCall } from '../../src/agent/apply.js';
import { MATERIALS } from '../../src/model/materials.js';

test('generator: unique ids, positive solids, known materials, nested layers', () => {
  const { parts } = generate(INITIAL_SPEC);
  assert.equal(parts.length, 184);
  assert.equal(new Set(parts.map(p => p.id)).size, parts.length);
  for (const p of parts) {
    for (let i = 0; i < 3; i++) assert.ok(p.max[i] > p.min[i], p.id);
    assert.ok(MATERIALS[p.material], p.material);
    assert.match(p.layer, /^Bedroom::/);
  }
});

test('Version 1 passes every check with an 830 mm walkway', () => {
  const g = generate(INITIAL_SPEC), c = check(INITIAL_SPEC, g);
  assert.equal(c.ok, true);
  assert.equal(c.walkway.mm, 830);
  assert.equal(c.clashes, 0);
  assert.ok(c.floorCoverage > 0.999);
});

test('wider planks step to the next stock width and the floor stays covered', () => {
  const r = applyCall(INITIAL_SPEC, { name: 'set_flooring', arguments: { material: 'walnut_light', plank_width_mm: null, plank_width_change: 'wider', plank_length_mm: null } });
  assert.equal(r.spec.flooring.plankWidth, 240);
  assert.equal(r.spec.flooring.material, 'walnut_light');
  assert.ok(check(r.spec, generate(r.spec)).floorCoverage > 0.999);
  assert.equal(INITIAL_SPEC.flooring.plankWidth, 180, 'input spec is not mutated');
});

test('wardrobe +100 mm carries the adjacent units by their rules', () => {
  const r = applyCall(INITIAL_SPEC, { name: 'change_dimension', arguments: { element: 'wardrobe', dimension: 'depth', delta_mm: 100, value_mm: null, adjust_adjacent: true } });
  const d = generate(r.spec).derived;
  assert.equal(d.adjacentDepth['tall-unit'], 700);
  assert.equal(d.adjacentDepth['drawer-unit'], 550);
  assert.equal(check(r.spec, generate(r.spec)).walkway.mm, 730);
});

test('a too-deep wardrobe is blocked by range and walkway', () => {
  const r = applyCall(INITIAL_SPEC, { name: 'change_dimension', arguments: { element: 'wardrobe', dimension: 'depth', delta_mm: 400, value_mm: null, adjust_adjacent: true } });
  const c = check(r.spec, generate(r.spec));
  assert.equal(c.ok, false);
  assert.equal(c.issues.filter(i => i.level === 'block').length, 2);
});

test('centre wood panels keep travertine on both sides and move the bed with the cladding', () => {
  const r = applyCall(INITIAL_SPEC, { name: 'set_wall_treatment', arguments: { zone: 'center', treatment: 'wood_panels', material: null, panel_width_mm: null, keep_other_zones: true } });
  const z = Object.fromEntries(r.spec.featureWall.zones.map(z => [z.id, z.treatment]));
  assert.deepEqual(z, { left: 'travertine', center: 'wood_panels', right: 'travertine' });
  assert.equal(generate(r.spec).derived.bed.y1 - generate(INITIAL_SPEC).derived.bed.y1, 2);
});

test('unknown materials, adjacent depths and wall finishes are refused with a reason', () => {
  assert.ok(applyCall(INITIAL_SPEC, { name: 'set_material', arguments: { element: 'bed', material: 'marble' } }).error);
  assert.ok(applyCall(INITIAL_SPEC, { name: 'change_dimension', arguments: { element: 'tall-unit', dimension: 'depth', delta_mm: 50, value_mm: null, adjust_adjacent: true } }).error);
  assert.ok(applyCall(INITIAL_SPEC, { name: 'set_material', arguments: { element: 'walls', material: 'walnut_dark' } }).error);
  const ok = applyCall(clone(INITIAL_SPEC), { name: 'set_material', arguments: { element: 'walls', material: 'plaster_lime' } });
  assert.ok(generate(ok.spec).parts.filter(p => p.element === 'walls').every(p => p.material === 'plaster_lime'));
});
