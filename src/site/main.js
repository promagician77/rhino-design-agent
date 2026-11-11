import { createViewer } from './viewer.js';
import { createSession, hash } from '../agent/session.js';
import { parse } from '../agent/parser.js';
import { generate } from '../model/generate.js';
import { MATERIALS } from '../model/materials.js';
import { to3dm } from '../model/to3dm.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
};
const MODEL = new Set(['set_flooring', 'set_wall_treatment', 'change_dimension', 'set_material']);

const session = createSession();
const log = $('#log');
const state = $('#vp-state');
const versionsEl = $('#versions');
const prebuilt = JSON.parse(versionsEl?.dataset.prebuilt || '{}');
let viewer = null, thumbs = null;

// ---------- 3D view ----------
function showSpec(spec, highlight = null) {
  if (!viewer) return;
  viewer.setModel(generate(spec).parts, { spec, highlight });
}
function changedIds(a, b) {
  const A = new Map(generate(a).parts.map(p => [p.id, JSON.stringify(p)]));
  return new Set(generate(b).parts.filter(p => A.get(p.id) !== JSON.stringify(p)).map(p => p.id));
}
function setState(text) { state.textContent = text; }
function currentLabel() {
  const hs = hash(session.spec);
  const v = [...session.versions].reverse().find(x => x.hash === hs);
  return v ? v.label : `${session.versions.at(-1).label}, with approved changes`;
}

function initViewer() {
  const canvas = $('#view');
  if (!canvas) return;
  try {
    viewer = createViewer(canvas, { onPick: showProps });
  } catch (e) { $('.vp-note').textContent = 'This browser could not start the 3D view, so a still image is shown. Everything else on the page works.'; return; }
  viewer.setView('hero');
  showSpec(session.spec);
  viewer.resize();
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.closest('.canvas-wrap').classList.add('live')));
}
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => { start(); setView(b.dataset.view); });
function setView(v) {
  viewer?.setView(v);
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
}

function showProps(p) {
  const box = $('#props');
  if (!p) { box.hidden = true; return; }
  let params = null;
  const spec = session.pending?.spec || session.spec;
  if (p.element === 'wardrobe') params = spec.wardrobe; else if (p.element === 'flooring') params = spec.flooring; else if (p.element === 'bed') params = spec.bed;
  else if (p.element.startsWith('feature-')) params = spec.featureWall.zones.find(z => `feature-${z.id}` === p.element);
  else { const u = spec.adjacent.find(u => u.id === p.element); if (u) params = { ...u, depth: generate(spec).derived.adjacentDepth[u.id] }; }
  const size = p.max.map((v, i) => Math.round((v - p.min[i]) * 10) / 10);
  box.replaceChildren(
    h('div', { class: 'props-h' }, h('b', {}, p.name), h('button', { type: 'button', class: 'x', 'aria-label': 'Close properties', onclick: () => { box.hidden = true; } }, '×')),
    h('dl', {},
      h('dt', {}, 'Layer'), h('dd', {}, p.layer.replace(/::/g, ' / ')),
      h('dt', {}, 'Material'), h('dd', {}, MATERIALS[p.material].name),
      h('dt', {}, 'Size'), h('dd', {}, `${size.join(' × ')} mm`),
      h('dt', {}, 'User text'), h('dd', { class: 'mono' }, `element=${p.element}\npart=${p.id}\nmaterial=${p.material}${params ? `\nparams=${JSON.stringify(params)}` : ''}`)),
  );
  box.hidden = false;
}

// ---------- conversation ----------
function scroll() { log.scrollTop = log.scrollHeight; }
function say(who, ...kids) { const m = h('div', { class: `msg ${who}` }, ...kids); log.append(m); scroll(); return m; }

function callsBlock(calls) {
  return h('details', { class: 'calls' }, h('summary', {}, `${calls.length} tool call${calls.length > 1 ? 's' : ''}: ${calls.map(c => c.name).join(', ')}`),
    h('pre', {}, calls.map(c => `${c.name}(${JSON.stringify(Object.fromEntries(Object.entries(c.arguments).filter(([, v]) => v !== null)), null, 1).replace(/\n\s*/g, ' ')})`).join('\n')));
}

function checksList(c) {
  const items = [
    [`Walkway to the bed ${c.walkway.mm} mm`, c.walkway.mm >= 700 ? 'ok' : 'bad', 'minimum 700'],
    [`Clashes between solids: ${c.clashes}`, c.clashes ? 'bad' : 'ok', ''],
    [`Floor covered ${Math.round(c.floorCoverage * 100)}%`, c.floorCoverage > 0.995 ? 'ok' : 'warn', ''],
  ];
  return h('ul', { class: 'checks' }, items.map(([t, s, n]) => h('li', { class: s }, h('span', { class: 'mark', 'aria-hidden': 'true' }, s === 'ok' ? '✓' : s === 'warn' ? '!' : '✕'), h('span', { class: 'vh' }, s === 'ok' ? 'Passes: ' : 'Fails: '), t, n ? h('small', {}, ` (${n})`) : null)),
    c.issues.map(i => h('li', { class: i.level === 'block' ? 'bad' : 'warn' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, '✕'), i.msg)));
}

function proposal(card, r) {
  const before = session.spec;
  if (r.errors.length && !r.changes.length) { card.append(h('p', { class: 'err' }, r.errors.join('. '))); return; }
  const box = h('div', { class: `proposal ${r.ready ? '' : 'blocked'}` },
    h('p', { class: 'p-h' }, r.ready ? 'Proposed change, not applied yet' : 'This change does not pass the checks'),
    h('ul', { class: 'changes' }, r.changes.map(c => h('li', {}, session.describe(c)))),
    r.consequences.length ? h('div', { class: 'cons' }, h('p', {}, 'Follows from it'), h('ul', {}, r.consequences.map(c => h('li', {}, c)))) : null,
    checksList(r.check),
    h('p', { class: 'diff' }, `In Rhino: ${r.diff.added} objects added, ${r.diff.removed} removed, ${r.diff.changed} changed.`));
  card.append(box);
  if (r.ready) {
    showSpec(r.spec, changedIds(before, r.spec));
    setState('Preview of the pending change');
    const approve = h('button', { type: 'button', class: 'primary', onclick: () => {
      const res = session.approve(); if (!res.ok) return;
      showSpec(session.spec); setState(currentLabel());
      actions.replaceWith(h('p', { class: 'done ok' }, 'Approved and applied.')); refreshVersions();
    } }, 'Approve');
    const reject = h('button', { type: 'button', onclick: () => {
      session.reject(); showSpec(session.spec); setState(currentLabel());
      actions.replaceWith(h('p', { class: 'done' }, 'Rejected. Nothing changed.'));
    } }, 'Reject');
    const actions = h('div', { class: 'actions' }, approve, reject);
    box.append(actions);
  } else if (r.suggestion) {
    box.append(h('div', { class: 'actions' }, h('p', {}, r.suggestion.text),
      h('button', { type: 'button', onclick: () => run(`Increase the wardrobe depth by ${r.suggestion.delta_mm} mm.`) }, `Try ${r.suggestion.delta_mm > 0 ? '+' : ''}${r.suggestion.delta_mm} mm`)));
  }
}

async function variants(card, n) {
  const list = session.variants(n);
  const grid = h('div', { class: 'vars' });
  card.append(h('p', {}, `${list.length} options for the feature wall. Each one is checked; pick one to preview it as a change.`), grid);
  for (const v of list) {
    const img = h('img', { alt: `Option ${v.key}: ${v.title}`, width: 300, height: 200 });
    grid.append(h('figure', {}, img, h('figcaption', {}, h('b', {}, `Option ${v.key}`), ` ${v.title}`),
      h('button', { type: 'button', onclick: () => { const r = session.adoptVariant(v); const c = say('agent', h('p', {}, `Option ${v.key} as a change:`)); proposal(c, r); } }, `Use option ${v.key}`)));
  }
  scroll();
  if (!thumbs) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400;
    try { thumbs = createViewer(c, { interactive: false }); } catch { return; }
  }
  for (const [i, v] of list.entries()) {
    await new Promise(r => setTimeout(r, 30));
    thumbs.setModel(generate(v.spec).parts, { spec: v.spec });
    grid.children[i].querySelector('img').src = thumbs.snapshot(600, 400, 'bed');
  }
}

function run(text) {
  text = text.trim();
  if (!text) return;
  start();
  say('you', h('p', {}, text));
  const calls = parse(text);
  const card = say('agent', callsBlock(calls));
  if (calls.some(c => MODEL.has(c.name))) proposal(card, session.propose(calls, text));
  for (const c of calls) {
    const a = c.arguments;
    if (c.name === 'ask_clarification') card.append(h('p', {}, a.question));
    else if (c.name === 'generate_variants') variants(card, a.count);
    else if (c.name === 'render_view') {
      if (viewer) { setView(a.view); card.append(h('img', { class: 'shot', src: viewer.snapshot(800, 500, a.view), alt: `Rendered ${a.view} view of the current model`, width: 400, height: 250 })); }
      card.append(h('p', {}, `Rendered the ${a.view === 'hero' ? 'perspective' : a.view} view.${session.pending ? ' It shows the pending change; approve it to keep it.' : ''}`));
    } else if (c.name === 'save_version') {
      const pend = !!session.pending;
      const v = session.save(a.label);
      refreshVersions(); setState(v.label);
      card.append(h('p', {}, `Saved ${v.label}: ${v.parts} objects.${pend ? ' The pending change was not included because it is not approved yet.' : ''} Download it under Versions.`));
    } else if (c.name === 'rollback') {
      const r = session.rollback(a.version);
      if (!r.ok) { card.append(h('p', { class: 'err' }, `There is no ${a.version} yet.`)); continue; }
      showSpec(session.spec); setState(currentLabel());
      card.append(h('p', {}, `Restored ${a.version}. ${r.matches ? 'The model matches the saved file exactly.' : ''}`));
    }
  }
  scroll();
}

// ---------- versions and .3dm ----------
let rhinoP = null;
const loadRhino = () => rhinoP ||= import(/* @vite-ignore */ new URL('vendor/rhino3dm.module.min.js', location.href).href)
  .then(m => m.default({ locateFile: f => new URL(`vendor/${f}`, location.href).href }));

async function download(v, btn) {
  const file = prebuilt[v.hash];
  const name = `${v.label.replace(/[^\w -]/g, '').replace(/\s+/g, '-')}.3dm`;
  if (file) { const a = h('a', { href: `models/${file}`, download: name }); document.body.append(a); a.click(); a.remove(); return; }
  btn.disabled = true; const t = btn.textContent; btn.textContent = 'Writing .3dm…';
  try {
    const rhino = await loadRhino();
    const { bytes } = to3dm(rhino, v.spec, { label: v.label, note: v.note });
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { btn.after(h('span', { class: 'err' }, ' Could not load the Rhino file writer.')); }
  btn.disabled = false; btn.textContent = t;
}

function refreshVersions() {
  if (!versionsEl) return;
  const hs = hash(session.spec);
  versionsEl.replaceChildren(...session.versions.map(v => h('li', { class: v.hash === hs ? 'cur' : '' },
    h('b', {}, v.label), h('span', { class: 'meta' }, `${v.note ? v.note + '. ' : ''}${v.parts} objects`),
    h('span', { class: 'btns' },
      h('button', { type: 'button', onclick: () => run(`Restore ${v.label}`), disabled: v.hash === hs }, 'Restore'),
      h('button', { type: 'button', onclick: e => download(v, e.currentTarget) }, 'Download .3dm')))));
}

// ---------- page wiring ----------
$('#ask')?.addEventListener('submit', e => { e.preventDefault(); const i = $('#say'); run(i.value); i.value = ''; });
for (const b of document.querySelectorAll('[data-say]')) b.addEventListener('click', () => run(b.dataset.say));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const p = $('#props'); if (p) p.hidden = true; } });
const cmp = $('#cmp');
cmp?.addEventListener('input', () => $('#compare').style.setProperty('--cut', `${cmp.value}%`));
refreshVersions();
setState('Version 1');
say('agent', h('p', {}, 'Version 1 is loaded: the sample bedroom reconstructed from its rendering. Try the instructions from the brief in order, or type your own.'));
// The live 3D view starts on first use (pointer, touch or keyboard on the view, a view button, or an instruction);
// until then the identical still image is shown, so the page loads without WebGL work.
let started = false;
function start() { if (started) return; started = true; initViewer(); }
const wrap = $('.canvas-wrap');
for (const ev of ['pointerenter', 'touchstart', 'focusin']) wrap?.addEventListener(ev, start, { once: true, passive: true });
