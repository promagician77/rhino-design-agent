// Phase 1 measurement: recover real dimensions from one rendering.
// A designer clicks a few edges and corners on the rendering. Edges that run along the two room axes meet at two
// vanishing points; those give the lens and the camera orientation. One true dimension from the drawings (here the
// ceiling height) gives the scale. Every other clicked point is then placed on the floor, the ceiling or a vertical.
// Pure math, no three.js: the same code runs in the Monte Carlo test (tools/measure-recon.mjs) and in the browser.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(...a));

// Test camera for the synthetic rendering. Level (2-point perspective), z up, millimetres, like an interior render.
export const TEST_CAMERA = { pos: [4550, -60, 1450], target: [2100, 3400, 1450], fovV: 72, width: 1600, height: 1000, shiftY: 0 };

export function cameraBasis(cam) {
  const f = norm(sub(cam.target, cam.pos));
  const r = norm(cross(f, [0, 0, 1]));
  const u = cross(r, f);
  const F = (cam.height / 2) / Math.tan((cam.fovV * Math.PI / 180) / 2);
  return { f, r, u, F, cx: cam.width / 2, cy: cam.height / 2 + (cam.shiftY || 0) };
}

export function project(cam, P, basis = cameraBasis(cam)) {
  const d = sub(P, cam.pos);
  const z = dot(d, basis.f);
  return [basis.cx + basis.F * dot(d, basis.r) / z, basis.cy - basis.F * dot(d, basis.u) / z, z];
}

// Least-squares intersection of image lines (each given by two clicked points).
export function vanishingPoint(segments) {
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (const [p, q] of segments) {
    let a = q[1] - p[1], b = p[0] - q[0];
    const n = Math.hypot(a, b); a /= n; b /= n;
    const c = -(a * p[0] + b * p[1]);
    const w = Math.hypot(q[0] - p[0], q[1] - p[1]); // longer clicked edges are more reliable
    a11 += w * a * a; a12 += w * a * b; a22 += w * b * b; b1 -= w * a * c; b2 -= w * b * c;
  }
  const det = a11 * a22 - a12 * a12;
  return [(a22 * b1 - a12 * b2) / det, (a11 * b2 - a12 * b1) / det];
}

// Closest point on the line A + s*u to the line B + t*v; returns s.
function closestS(A, u, B, v) {
  const w = sub(A, B), a = dot(u, u), b = dot(u, v), c = dot(v, v), d = dot(u, w), e = dot(v, w);
  return (b * e - c * d) / (a * c - b * b);
}

/**
 * clicks: { linesX: [[p,q],...] (q further along +x), linesY: [...] (q further along +y), origin: px (a floor corner),
 *           originTop: px (the same corner at the ceiling), floor: {name: px}, ceiling: {name: px}, verticals: {name: [floorPx, topPx]} }
 * known: { ceilingHeight } in mm. opts.principal: 'centre' (image centre) or 'horizon' (level camera: on the horizon line).
 * Returns positions in mm relative to the origin corner, plus the recovered lens and camera height.
 */
export function reconstruct(clicks, known, size, opts = {}) {
  const vx = vanishingPoint(clicks.linesX), vy = vanishingPoint(clicks.linesY);
  let cx = size.width / 2, cy = size.height / 2;
  if (opts.principal === 'horizon') cy = vx[1] + (vy[1] - vx[1]) * (cx - vx[0]) / (vy[0] - vx[0]);
  const F2 = -((vx[0] - cx) * (vy[0] - cx) + (vx[1] - cy) * (vy[1] - cy));
  if (!(F2 > 0)) return { ok: false, reason: 'vanishing points are not consistent with two perpendicular directions' };
  const F = Math.sqrt(F2);
  const ray = p => [p[0] - cx, cy - p[1], F]; // camera frame: right, up, forward
  const dirOf = (vp, [p, q]) => mul(norm(ray(vp)), Math.sign((q[0] - p[0]) * (vp[0] - p[0]) + (q[1] - p[1]) * (vp[1] - p[1])));
  const dx = dirOf(vx, clicks.linesX[0]), dy = dirOf(vy, clicks.linesY[0]);
  let dz = norm(cross(dx, dy));
  if (dz[1] < 0) dz = mul(dz, -1); // the camera frame is left-handed; world up must point up in the image
  const world = p => { const c = ray(p); return [dot(c, dx), dot(c, dy), dot(c, dz)]; };

  const C = [0, 0, 1]; // camera at unit height; everything scales at the end
  const onPlane = (p, z) => { const w = world(p); const t = (z - C[2]) / w[2]; return t > 0 ? add(C, mul(w, t)) : null; };
  const O = onPlane(clicks.origin, 0);
  if (!O) return { ok: false, reason: 'origin is not on the floor' };
  const heightAbove = (base, topPx) => closestS(base, [0, 0, 1], C, world(topPx));
  const Hunit = heightAbove(O, clicks.originTop);
  const k = known.ceilingHeight / Hunit;
  const rel = P => [(P[0] - O[0]) * k, (P[1] - O[1]) * k, P[2] * k];

  const out = { ok: true, focalPx: F, fovV: 2 * Math.atan(size.height / 2 / F) * 180 / Math.PI, cameraHeight: k, vpX: vx, vpY: vy, principal: [cx, cy], points: {}, heights: {} };
  // Floor points may sit on a known finish height (a rug, a plinth); zmm says how high above the floor.
  const zOf = n => (clicks.zmm?.[n] || 0) / k;
  for (const [n, p] of Object.entries(clicks.floor || {})) { const P = onPlane(p, zOf(n)); out.points[n] = P && rel(P); }
  for (const [n, p] of Object.entries(clicks.ceiling || {})) { const P = onPlane(p, Hunit); out.points[n] = P && rel(P); }
  for (const [n, [fp, tp]] of Object.entries(clicks.verticals || {})) { const B = onPlane(fp, zOf(n)); out.heights[n] = B ? (heightAbove(B, tp) + zOf(n)) * k : null; }
  return out;
}

// The test: which 3D points a person clicks on the rendering, and which dimensions are read from them.
// Every point is checked for visibility from the test camera (tools/measure-recon.mjs), so nothing hidden is clicked.
export function clickPlan(spec, gen) {
  const { width: W, depth: D, height: H } = spec.room;
  const yc = D - gen.derived.claddingDepth.left; // face of the cladding
  const b = gen.derived.bed, bh = spec.bed.height, rz = spec.rug.thickness;
  const wf = gen.derived.wardrobeFront, wy0 = spec.wardrobe.y, wy1 = spec.wardrobe.y + spec.wardrobe.width + spec.adjacent[0].width;
  const sw = spec.featureWall.travertine.slabWidth, sh = spec.featureWall.travertine.slabHeight;
  return {
    linesX: [[[0, yc, H], [W - 300, yc, H]], [[W - 1200, yc, sh], [W - 300, yc, sh]], [[b.x0, b.y0, bh], [b.x1, b.y0, bh]], [[b.x0, b.y0, rz], [b.x1, b.y0, rz]]],
    linesY: [[[wf, wy0, spec.wardrobe.height], [wf, wy1, spec.wardrobe.height]], [[wf, wy0, 20], [wf, wy0 + 1800, 20]], [[b.x1, b.y0, bh], [b.x1, b.y1 - spec.bedside.depth - 20, bh]]],
    origin: [W - 600, yc, 0], originTop: [W - 600, yc, H], // a slab joint near the right-hand corner; the corner itself is behind the curtain
    floor: { wardrobeFrontS: [wf, wy0, 0], bedFootL: [b.x0, b.y0, rz], bedFootR: [b.x1, b.y0, rz] },
    zmm: { bedFootL: rz, bedFootR: rz, bedHeight: rz },
    ceiling: { cornerNW: [0, yc, H], joint1: [sw, yc, H], joint5: [5 * sw, yc, H], eastWall: [W, 3000, H] },
    verticals: { wardrobeHeight: [[wf, wy0, 0], [wf, wy0, spec.wardrobe.height]], bedHeight: [[b.x1, b.y0, rz], [b.x1, b.y0, bh]], slabHeight: [[W - 600, yc, 0], [W - 600, yc, 2 * sh]] },
  };
}

// Dimensions a designer needs for the Rhino model. Only differences between clicked points are used, so nothing
// depends on knowing where the origin corner is in the room.
export function dimensions(r) {
  const p = r.points, h = r.heights, west = p.cornerNW[0];
  return {
    'Room width (wall to wall)': p.eastWall[0] - west,
    'Wardrobe front from wall': p.wardrobeFrontS[0] - west,
    'Wardrobe run to feature wall': -p.wardrobeFrontS[1],
    'Wardrobe height': h.wardrobeHeight,
    'Bed width': p.bedFootR[0] - p.bedFootL[0],
    'Bed + headboard length': -(p.bedFootL[1] + p.bedFootR[1]) / 2,
    'Bed centre from west wall': (p.bedFootL[0] + p.bedFootR[0]) / 2 - west,
    'Bed height': h.bedHeight,
    'Travertine slab width': (p.joint5[0] - p.joint1[0]) / 4,
    'Travertine slab height': h.slabHeight / 2,
  };
}

export function truthDimensions(spec, gen) {
  const b = gen.derived.bed, D = spec.room.depth, yc = D - gen.derived.claddingDepth.left;
  return {
    'Room width (wall to wall)': spec.room.width,
    'Wardrobe front from wall': gen.derived.wardrobeFront,
    'Wardrobe run to feature wall': yc - spec.wardrobe.y,
    'Wardrobe height': spec.wardrobe.height,
    'Bed width': b.x1 - b.x0,
    'Bed + headboard length': yc - b.y0,
    'Bed centre from west wall': (b.x0 + b.x1) / 2,
    'Bed height': spec.bed.height,
    'Travertine slab width': spec.featureWall.travertine.slabWidth,
    'Travertine slab height': spec.featureWall.travertine.slabHeight,
  };
}
