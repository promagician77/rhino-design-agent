// Checks that run after every change, before anything is shown as "ready to approve".
const ALLOWED = new Set(['bed|rug', 'rug|bed']);

function overlap(a, b) {
  let v = 1;
  for (let k = 0; k < 3; k++) {
    const o = Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);
    if (o <= 0.001) return 0;
    v *= o;
  }
  return v;
}

export function clashes(parts) {
  const out = [];
  const sorted = [...parts].sort((a, b) => a.min[0] - b.min[0]);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length && sorted[j].min[0] < a.max[0]; j++) {
      const b = sorted[j];
      if (a.element === b.element || ALLOWED.has(`${a.element}|${b.element}`)) continue;
      const v = overlap(a, b);
      if (v > 1) out.push({ a: a.id, b: b.id, volume: Math.round(v) });
    }
  }
  return out;
}

const yOverlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0;

// Clear floor between joinery fronts on the west wall and the furniture facing them.
export function walkway(spec, gen) {
  const fronts = gen.parts.filter(p => /^(wardrobe|tall-unit|drawer-unit)-(carcass|door|drawer-\d)$/.test(p.id) || /^wardrobe-door-\d$/.test(p.id));
  const facing = gen.parts.filter(p => p.element === 'bed' && p.id === 'bed-base' || p.element === 'bedside');
  let min = Infinity, between = null;
  for (const j of fronts) for (const f of facing) {
    if (!yOverlap(j.min[1], j.max[1], f.min[1], f.max[1])) continue;
    const gap = f.min[0] - j.max[0];
    if (gap < min) { min = gap; between = [j.name, f.name]; }
  }
  return { mm: Math.round(min * 10) / 10, between };
}

export function check(spec, gen) {
  const issues = [];
  const r = spec.rules;
  const wd = spec.wardrobe.depth;
  if (wd < r.wardrobeDepth[0] || wd > r.wardrobeDepth[1]) issues.push({ level: 'block', msg: `wardrobe depth ${wd} mm is outside ${r.wardrobeDepth[0]}-${r.wardrobeDepth[1]} mm` });
  const pw = spec.flooring.plankWidth;
  if (pw < r.plankWidth[0] || pw > r.plankWidth[1]) issues.push({ level: 'block', msg: `plank width ${pw} mm is outside ${r.plankWidth[0]}-${r.plankWidth[1]} mm` });
  const sum = spec.featureWall.zones.reduce((s, z) => s + z.width, 0);
  if (Math.abs(sum - spec.room.width) > 0.5) issues.push({ level: 'block', msg: `feature wall zones add up to ${sum} mm, the wall is ${spec.room.width} mm` });
  const wk = walkway(spec, gen);
  if (wk.mm < r.minWalkway) issues.push({ level: 'block', msg: `walkway between ${wk.between[0].toLowerCase()} and ${wk.between[1].toLowerCase()} would be ${wk.mm} mm, below the ${r.minWalkway} mm minimum` });
  const cl = clashes(gen.parts);
  if (cl.length) issues.push({ level: 'block', msg: `${cl.length} clash${cl.length > 1 ? 'es' : ''}, first: ${cl[0].a} with ${cl[0].b}` });
  const planks = gen.parts.filter(p => p.element === 'flooring');
  const area = planks.reduce((s, p) => s + (p.max[0] - p.min[0]) * (p.max[1] - p.min[1]), 0);
  const floorArea = spec.room.width * spec.room.depth;
  if (Math.abs(area - floorArea) > 1) issues.push({ level: 'block', msg: `planks cover ${Math.round(area)} of ${floorArea} mm²` });
  return { ok: !issues.length, issues, walkway: wk, clashes: cl.length, floorCoverage: area / floorArea };
}
