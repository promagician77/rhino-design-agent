// A design session: instruction -> tool calls -> proposed change (checked) -> approve or reject -> versions.
import { INITIAL_SPEC, clone } from '../model/spec.js';
import { generate } from '../model/generate.js';
import { check } from '../model/checks.js';
import { applyCall, describeChange, TREATMENT_NAME } from './apply.js';
import { MATERIALS } from '../model/materials.js';

export function stable(o) {
  if (Array.isArray(o)) return `[${o.map(stable).join(',')}]`;
  if (o && typeof o === 'object') return `{${Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',')}}`;
  return JSON.stringify(o);
}
export function hash(o) { // cyrb53
  const s = stable(o);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

// Geometry diff by part id: what Rhino will add, delete and modify when the change is applied.
export function diffParts(a, b) {
  const A = new Map(a.map(p => [p.id, p])), B = new Map(b.map(p => [p.id, p]));
  let added = 0, removed = 0, changed = 0;
  const elements = new Set();
  for (const [id, p] of B) { const q = A.get(id); if (!q) { added++; elements.add(p.element); } else if (stable(q) !== stable(p)) { changed++; elements.add(p.element); } }
  for (const [id, q] of A) if (!B.has(id)) { removed++; elements.add(q.element); }
  return { added, removed, changed, elements: [...elements] };
}

export const VARIANTS = [
  { key: 'A', title: 'Fluted oak centre', calls: [{ name: 'set_wall_treatment', arguments: { zone: 'center', treatment: 'fluted', material: null, panel_width_mm: null, keep_other_zones: true } }] },
  { key: 'B', title: 'Lime plaster with walnut shelf, silver travertine sides', calls: [
    { name: 'set_wall_treatment', arguments: { zone: 'center', treatment: 'plaster_shelf', material: null, panel_width_mm: null, keep_other_zones: true } },
    { name: 'set_wall_treatment', arguments: { zone: 'left', treatment: 'travertine', material: 'travertine_silver', panel_width_mm: null, keep_other_zones: true } },
    { name: 'set_wall_treatment', arguments: { zone: 'right', treatment: 'travertine', material: 'travertine_silver', panel_width_mm: null, keep_other_zones: true } }] },
  { key: 'C', title: 'Full-width smoked oak panels', calls: [{ name: 'set_wall_treatment', arguments: { zone: 'all', treatment: 'wood_panels', material: 'smoked_oak_veneer', panel_width_mm: 1200, keep_other_zones: false } }] },
  { key: 'D', title: 'Travertine centre, fluted oak sides', calls: [
    { name: 'set_wall_treatment', arguments: { zone: 'left', treatment: 'fluted', material: null, panel_width_mm: null, keep_other_zones: true } },
    { name: 'set_wall_treatment', arguments: { zone: 'right', treatment: 'fluted', material: null, panel_width_mm: null, keep_other_zones: true } }] },
];

export function createSession(initial = INITIAL_SPEC) {
  const s = {
    spec: clone(initial),
    versions: [],
    pending: null,
    log: [],
  };
  const gen0 = generate(s.spec);
  s.versions.push({ label: 'Version 1', note: 'Reconstructed from the rendering', spec: clone(s.spec), hash: hash(s.spec), parts: gen0.parts.length });

  function evaluate(spec, prevSpec) {
    const prev = generate(prevSpec);
    const gen = generate(spec);
    const chk = check(spec, gen);
    return { gen, check: chk, diff: diffParts(prev.parts, gen.parts), derived: gen.derived, prevDerived: prev.derived };
  }

  function consequences(prev, ev) {
    const out = [];
    const a = prev.adjacentDepth, b = ev.derived.adjacentDepth;
    for (const k of Object.keys(b)) if (a[k] !== b[k]) out.push(`${k === 'tall-unit' ? 'Tall linen cabinet' : 'Drawer unit'} depth ${a[k]} → ${b[k]} mm (${k === 'tall-unit' ? 'fronts stay flush' : 'front stays 150 mm behind the wardrobe'})`);
    const wa = prev.walkwayMm, wb = ev.check.walkway.mm;
    if (wa !== undefined && wa !== wb) out.push(`Walkway to the bed ${wa} → ${wb} mm (minimum ${s.spec.rules.minWalkway})`);
    for (const k of Object.keys(ev.derived.claddingDepth)) if (prev.claddingDepth[k] !== ev.derived.claddingDepth[k]) out.push(`${k} cladding depth ${prev.claddingDepth[k]} → ${ev.derived.claddingDepth[k]} mm`);
    if (prev.bed.y1 !== ev.derived.bed.y1) out.push(`Bed and bedside tables move ${Math.abs(ev.derived.bed.y1 - prev.bed.y1)} mm to stay against the headboard wall`);
    return out;
  }

  // Turns tool calls into one proposal. Nothing changes until approve().
  s.propose = (calls, instruction = '') => {
    const modelCalls = calls.filter(c => ['set_flooring', 'set_wall_treatment', 'change_dimension', 'set_material'].includes(c.name));
    const actions = calls.filter(c => !modelCalls.includes(c));
    const result = { instruction, calls, changes: [], errors: [], actions, consequences: [] };
    if (modelCalls.length) {
      let spec = s.spec;
      for (const c of modelCalls) {
        const r = applyCall(spec, c);
        if (r.error) { result.errors.push(r.error); continue; }
        spec = r.spec; result.changes.push(...r.changes);
      }
      const prevGen = generate(s.spec);
      const prev = { ...prevGen.derived, walkwayMm: check(s.spec, prevGen).walkway.mm };
      const ev = evaluate(spec, s.spec);
      result.spec = spec;
      result.check = ev.check;
      result.diff = ev.diff;
      result.consequences = consequences(prev, ev);
      if (!result.changes.length && !result.errors.length) result.errors.push('nothing would change');
      result.ready = !result.errors.length && ev.check.ok && result.changes.length > 0;
      if (!result.ready && !ev.check.ok) {
        // Suggest the largest change that still passes, for single-dimension requests.
        const dc = modelCalls.find(c => c.name === 'change_dimension' && c.arguments.delta_mm);
        if (dc && modelCalls.length === 1) result.suggestion = largestPassing(s.spec, dc);
      }
      s.pending = result.ready ? result : null;
    }
    s.log.push(result);
    return result;
  };

  function largestPassing(spec, c) {
    const sign = Math.sign(c.arguments.delta_mm);
    let best = 0;
    for (let d = 5; d <= Math.abs(c.arguments.delta_mm); d += 5) {
      const r = applyCall(spec, { ...c, arguments: { ...c.arguments, delta_mm: sign * d } });
      if (r.error) break;
      if (check(r.spec, generate(r.spec)).ok) best = d; else break;
    }
    return best ? { delta_mm: sign * best, text: `The most that passes is ${sign > 0 ? '+' : '-'}${best} mm.` } : null;
  }

  s.approve = () => {
    if (!s.pending) return { ok: false, error: 'nothing to approve' };
    s.spec = s.pending.spec;
    const p = s.pending; s.pending = null;
    return { ok: true, applied: p.changes.length, hash: hash(s.spec) };
  };
  s.reject = () => { const had = !!s.pending; s.pending = null; return { ok: had }; };

  s.save = (label) => {
    const existing = s.versions.find(v => v.label.toLowerCase() === label.toLowerCase());
    const v = { label: existing ? `${label} (${s.versions.length + 1})` : label, note: '', spec: clone(s.spec), hash: hash(s.spec), parts: generate(s.spec).parts.length };
    s.versions.push(v);
    return v;
  };
  s.rollback = (label) => {
    const v = s.versions.find(x => x.label.toLowerCase() === label.toLowerCase());
    if (!v) return { ok: false, error: `no ${label}` };
    s.spec = clone(v.spec); s.pending = null;
    return { ok: true, hash: hash(s.spec), matches: hash(s.spec) === v.hash };
  };
  s.variants = (count) => VARIANTS.slice(0, count).map(v => {
    let spec = s.spec; const changes = [];
    for (const c of v.calls) { const r = applyCall(spec, c); spec = r.spec; changes.push(...r.changes); }
    const gen = generate(spec);
    return { key: v.key, title: v.title, calls: v.calls, spec, changes, check: check(spec, gen), parts: gen.parts.length };
  });
  s.adoptVariant = (variant) => {
    const result = { instruction: `Use option ${variant.key}`, calls: variant.calls, changes: variant.changes, errors: [], actions: [] };
    const prevGen = generate(s.spec);
    const prev = { ...prevGen.derived, walkwayMm: check(s.spec, prevGen).walkway.mm };
    const ev = evaluate(variant.spec, s.spec);
    Object.assign(result, { spec: variant.spec, check: ev.check, diff: ev.diff, consequences: consequences(prev, ev), ready: ev.check.ok && variant.changes.length > 0 });
    s.pending = result.ready ? result : null;
    return result;
  };
  s.describe = describeChange;
  return s;
}

export { TREATMENT_NAME, MATERIALS };
