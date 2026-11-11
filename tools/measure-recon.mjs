// Phase 1 accuracy test. A hidden "true" model (Version 1) is rendered from a known camera; the points a designer
// would click are projected into that image, click error is added, and the dimensions are recovered with
// src/recon/metrology.js. Repeated 2,000 times per click-error level. Writes data/recon.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { INITIAL_SPEC } from '../src/model/spec.js';
import { generate } from '../src/model/generate.js';
import { TEST_CAMERA, project, clickPlan, reconstruct, dimensions, truthDimensions } from '../src/recon/metrology.js';

const spec = INITIAL_SPEC, gen = generate(spec);
const plan = clickPlan(spec, gen);
const truth = truthDimensions(spec, gen);

let seed = 42;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

function clicksFor(cam, sigma) {
  const P = x => { const [u, v, z] = project(cam, x); if (z <= 0) throw new Error('behind camera'); return [u + sigma * gauss(), v + sigma * gauss()]; };
  const m = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, P(v)]));
  return {
    linesX: plan.linesX.map(([a, b]) => [P(a), P(b)]), linesY: plan.linesY.map(([a, b]) => [P(a), P(b)]),
    origin: P(plan.origin), originTop: P(plan.originTop), floor: m(plan.floor), ceiling: m(plan.ceiling), zmm: plan.zmm,
    verticals: Object.fromEntries(Object.entries(plan.verticals).map(([k, [a, b]]) => [k, [P(a), P(b)]])),
  };
}

// Every clicked point must be inside the image.
const inFrame = [];
const all = [...plan.linesX.flat(), ...plan.linesY.flat(), plan.origin, plan.originTop, ...Object.values(plan.floor), ...Object.values(plan.ceiling), ...Object.values(plan.verticals).flat()];
for (const x of all) { const [u, v, z] = project(TEST_CAMERA, x); inFrame.push({ x, u: +u.toFixed(1), v: +v.toFixed(1), ok: z > 0 && u > 8 && u < TEST_CAMERA.width - 8 && v > 8 && v < TEST_CAMERA.height - 8 }); }
const outside = inFrame.filter(p => !p.ok);
if (outside.length) { console.log('outside frame', outside); process.exit(1); }

// Every clicked point must be visible: the segment from the camera to it may not pass through any solid.
function occluder(P) {
  const C = TEST_CAMERA.pos, d = [P[0] - C[0], P[1] - C[1], P[2] - C[2]];
  const len = Math.hypot(...d), stop = 1 - 3 / len;
  for (const q of gen.parts) {
    if (q.material === 'glass_clear') continue;
    if ([0, 1, 2].every(i => C[i] >= q.min[i] && C[i] <= q.max[i])) continue; // the camera sits inside the south wall; the renderer cuts it away
    let t0 = 0, t1 = stop;
    for (let i = 0; i < 3 && t0 <= t1; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (C[i] < q.min[i] || C[i] > q.max[i]) t0 = 2; continue; }
      let a = (q.min[i] - C[i]) / d[i], b = (q.max[i] - C[i]) / d[i]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t0 < t1 - 1e-9) return q.id;
  }
  return null;
}
const hidden = all.map(x => ({ x, by: occluder(x) })).filter(o => o.by);
if (hidden.length) { console.log('hidden points', hidden); process.exit(1); }
console.log(`${all.length} clicked points: all inside the image and visible from the camera`);

const size = { width: TEST_CAMERA.width, height: TEST_CAMERA.height };
const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

function run(cam, sigma, known, opts, trials = 2000) {
  const errs = Object.fromEntries(Object.keys(truth).map(k => [k, []]));
  const fov = []; let failed = 0;
  for (let i = 0; i < trials; i++) {
    const r = reconstruct(clicksFor(cam, sigma), known, size, opts);
    if (!r.ok) { failed++; continue; }
    fov.push(r.fovV);
    const d = dimensions(r);
    for (const k of Object.keys(truth)) errs[k].push(d[k] - truth[k]);
  }
  const rows = Object.keys(truth).map(k => {
    const e = errs[k], abs = e.map(Math.abs);
    return { dimension: k, truth: truth[k], meanErr: +(e.reduce((a, b) => a + b, 0) / e.length).toFixed(1), medianAbs: +pct(abs, 0.5).toFixed(1), p95Abs: +pct(abs, 0.95).toFixed(1), p95Pct: +(100 * pct(abs, 0.95) / truth[k]).toFixed(2) };
  });
  return { sigma, trials, failed, fovV: { truth: cam.fovV, median: +pct(fov, 0.5).toFixed(2), p95Abs: +pct(fov.map(f => Math.abs(f - cam.fovV)), 0.95).toFixed(2) }, rows };
}

// Noise-free check: must be exact.
const exact = reconstruct(clicksFor(TEST_CAMERA, 0), { ceilingHeight: spec.room.height }, size);
const ed = dimensions(exact);
const maxExact = Math.max(...Object.keys(truth).map(k => Math.abs(ed[k] - truth[k])));
console.log('noise-free max error (mm):', maxExact.toExponential(2), 'fov', exact.fovV.toFixed(3));
if (maxExact > 1e-6) process.exit(1);

const known = { ceilingHeight: spec.room.height };
const results = {
  camera: TEST_CAMERA, image: size, points: all.length, clicks: inFrame.map(p => ({ u: p.u, v: p.v })),
  withDrawings: [0.5, 1, 2, 3].map(s => run(TEST_CAMERA, s, known, {})),
  noDrawings: run(TEST_CAMERA, 1, { ceilingHeight: 3000 }, {}),
  lensShift: {
    note: 'Same rendering made with a vertical lens shift of 12% of the image height, a common way to keep verticals straight.',
    assumeCentre: run({ ...TEST_CAMERA, shiftY: 120 }, 1, known, { principal: 'centre' }),
    fromHorizon: run({ ...TEST_CAMERA, shiftY: 120 }, 1, known, { principal: 'horizon' }),
  },
  plan,
};
mkdirSync('data', { recursive: true });
writeFileSync('data/recon.json', JSON.stringify(results, null, 2));

const show = (title, r) => { console.log(`\n${title}  sigma ${r.sigma}px  fov ${r.fovV.median} (true ${r.fovV.truth})  failed ${r.failed}`); console.table(r.rows.map(x => ({ dimension: x.dimension, truth: x.truth, bias: x.meanErr, median: x.medianAbs, p95: x.p95Abs, 'p95 %': x.p95Pct }))); };
for (const r of results.withDrawings) show('Ceiling height from drawings', r);
show('No drawings: ceiling assumed 3000', results.noDrawings);
show('Lens shift, principal point assumed at centre', results.lensShift.assumeCentre);
show('Lens shift, principal point on the horizon', results.lensShift.fromHorizon);
