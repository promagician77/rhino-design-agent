// Runs the PoC script end to end (the client's five instructions plus a constraint test) through the same
// parser -> proposal -> check -> approve -> save path the site uses, and writes real .3dm files for every version.
// Output: build/models/*.3dm and data/session.json (transcript, checks, diffs, hashes).
import rhino3dmInit from 'rhino3dm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSession, hash } from '../src/agent/session.js';
import { parse } from '../src/agent/parser.js';
import { to3dm } from '../src/model/to3dm.js';
import { generate } from '../src/model/generate.js';
import { check } from '../src/model/checks.js';

const rhino = await rhino3dmInit();
mkdirSync('build/models', { recursive: true });
mkdirSync('data', { recursive: true });

const files = [];
const write = (name, spec, label, note) => {
  const t0 = performance.now();
  const r = to3dm(rhino, spec, { label, note });
  const ms = performance.now() - t0;
  writeFileSync(`build/models/${name}`, r.bytes);
  files.push({ file: name, label, note, objects: r.objects, layers: r.layers, materials: r.materials, bytes: r.bytes.length, ms: +ms.toFixed(1), hash: hash(spec) });
};

const s = createSession();
write('Version-1.3dm', s.spec, 'Version 1', 'Reconstructed from the rendering');

const SCRIPT = [
  'Change the bedroom flooring to light walnut with wider planks.',
  'Replace the central wall treatment with large-format wood panels while retaining travertine on either side.',
  'Increase the wardrobe depth by 100 mm and adjust the adjacent cabinetry.',
  'Increase the wardrobe depth by another 300 mm.',
  'Generate three alternative designs for the feature wall.',
  'Show me the updated rendering and save this as Version 2.',
];
const turns = [];
for (const text of SCRIPT) {
  const calls = parse(text);
  const turn = { text, calls };
  if (calls.some(c => c.name === 'generate_variants')) {
    const v = s.variants(calls.find(c => c.name === 'generate_variants').arguments.count || 3);
    turn.variants = v.map(x => ({ key: x.key, title: x.title, ok: x.check.ok, parts: x.parts, changes: x.changes.map(s.describe), walkway: x.check.walkway.mm, hash: hash(x.spec) }));
    for (const x of v) write(`Variant-${x.key}.3dm`, x.spec, `Option ${x.key}`, x.title);
  }
  const r = s.propose(calls, text);
  if (r.changes.length || r.errors.length) {
    Object.assign(turn, {
      changes: r.changes.map(s.describe), errors: r.errors, ready: r.ready, diff: r.diff, consequences: r.consequences,
      checks: r.check && { ok: r.check.ok, issues: r.check.issues, walkway: r.check.walkway.mm, clashes: r.check.clashes, floorCoverage: r.check.floorCoverage },
      suggestion: r.suggestion || null,
    });
    turn.decision = r.ready ? 'approved' : 'blocked';
    if (r.ready) turn.approve = s.approve();
  }
  if (calls.some(c => c.name === 'save_version')) {
    const label = calls.find(c => c.name === 'save_version').arguments.label;
    const v = s.save(label);
    turn.saved = { label: v.label, hash: v.hash, parts: v.parts };
    write('Version-2.3dm', s.spec, v.label, 'Walnut floor, wider planks; wood panel centre; wardrobe +100 mm');
  }
  turns.push(turn);
}

// Rollback proof: restore Version 1, compare hashes and regenerated geometry, then return to Version 2.
const rb1 = s.rollback('Version 1');
const v1parts = generate(s.spec).parts;
const rb2 = s.rollback('Version 2');
const g2 = generate(s.spec);
const final = check(s.spec, g2);

const out = {
  generated: new Date().toISOString().slice(0, 10),
  turns,
  versions: s.versions.map(v => ({ label: v.label, note: v.note, hash: v.hash, parts: v.parts })),
  rollback: { toV1: rb1, v1Parts: v1parts.length, backToV2: rb2 },
  final: { ok: final.ok, walkway: final.walkway.mm, clashes: final.clashes, floorCoverage: final.floorCoverage, derived: g2.derived },
  files,
};
writeFileSync('data/session.json', JSON.stringify(out, null, 2));
for (const t of turns) console.log(`${t.decision || '-'}\t${t.text}\n\t${(t.changes || []).join(' | ')}${t.suggestion ? '\n\tsuggest ' + t.suggestion.text : ''}`);
console.table(files.map(({ file, objects, layers, materials, bytes, ms }) => ({ file, objects, layers, materials, kb: (bytes / 1024).toFixed(0), ms })));
console.log('rollback', rb1, rb2);
