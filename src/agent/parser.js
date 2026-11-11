// Demo stand-in for the language model: turns an instruction into the same tool calls GPT is asked to produce.
// It covers the instruction types in the brief and their common phrasings. Anything else becomes ask_clarification,
// which is also what the production model is told to do. Production swaps this file for an OpenAI call (llm.js).
import { MATERIAL_WORDS, MATERIALS } from '../model/materials.js';

const call = (name, args) => ({ name, arguments: args });
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, a: 1, an: 1 };

function materialIn(t, filter = () => true) {
  for (const [w, id] of MATERIAL_WORDS) if (t.includes(w) && filter(id)) return id;
  return null;
}

function amount(t) {
  const m = t.match(/(-?\d+(?:\.\d+)?)\s*(mm|millimet(?:er|re)s?|cm|centimet(?:er|re)s?|m\b|met(?:er|re)s?)?/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const u = (m[2] || 'mm').toLowerCase();
  return u.startsWith('c') ? v * 10 : (u === 'm' || u.startsWith('met')) ? v * 1000 : v;
}

const ELEMENT_WORDS = [
  [/\b(wardrobe|closet|built-?in)\b/, 'wardrobe'], [/\b(tall|linen) (unit|cabinet)\b/, 'tall-unit'],
  [/\b(drawer (unit|chest)|chest of drawers|dresser)\b/, 'drawer-unit'], [/\b(bedside|nightstand|night stand)s?\b/, 'bedside'],
  [/\brug\b/, 'rug'], [/\bbed\b/, 'bed'],
];

function clause(t, ctx) {
  const out = [];
  if (/\b(delete|remove|erase|clear)\b.*\b(everything|all|model|room|objects?)\b/.test(t)) {
    return [call('ask_clarification', { question: 'I do not delete objects. I can change a finish, a dimension or a wall treatment, or restore an earlier version. What would you like to change?' })];
  }
  if (/\b(roll ?back|go back|revert|restore|undo)\b/.test(t)) {
    const v = t.match(/\b(?:version|v)\s*(\d+)/);
    return [v ? call('rollback', { version: `Version ${v[1]}` }) : call('ask_clarification', { question: 'Which version should I restore?' })];
  }
  const variants = t.match(/\b(generate|create|show|give|propose|suggest|make|explore)\b.*?\b(\d+|one|two|three|four|a|an)\s+(?:\w+\s+){0,3}(alternatives?|options?|variants?|versions?|designs?|ideas?)\b/);
  if (variants && /\b(wall|feature|headboard)\b/.test(t)) {
    const c = WORDNUM[variants[2]] || parseInt(variants[2], 10);
    return [call('generate_variants', { count: Math.min(4, Math.max(1, c)) })];
  }
  const saving = t.match(/\b(?:save|store|keep|call)\b.*?\b(?:as\s+)?(?:version|v)\s*(\d+)/) || t.match(/\b(?:save|store)\b.*?\bas\s+"?([a-z0-9 -]{2,30})"?$/);
  const rendering = /\b(show|render|preview|see|view)\b.*\b(render(ing)?|image|picture|view|preview|visual)/.test(t) || /\brender\b/.test(t);
  if (rendering && !/\b(floor|wall|plank|deeper|wider|material)\b/.test(t)) out.push(call('render_view', { view: /wardrobe/.test(t) ? 'wardrobe' : /\bbed\b/.test(t) ? 'bed' : /\bplan\b/.test(t) ? 'plan' : 'hero' }));
  if (saving) out.push(call('save_version', { label: /^\d+$/.test(saving[1]) ? `Version ${saving[1]}` : saving[1].trim().replace(/^\w/, c => c.toUpperCase()) }));
  if (out.length) return out;

  // Flooring
  if (/\b(floor|flooring|floorboards?|planks?|boards?|parquet)\b/.test(t)) {
    const mat = materialIn(t, id => MATERIALS[id].grain === 'wood');
    if (/\b(marble|tile|tiles|carpet|vinyl|concrete)\b/.test(t) && !mat) return [call('ask_clarification', { question: 'That floor material is not in the library yet. I can use oak natural, walnut light, walnut dark or smoked oak. Which one?' })];
    const wider = /\b(wider|broader|wide planks|larger planks)\b/.test(t) ? 'wider' : /\b(narrower|thinner|slimmer)\b/.test(t) ? 'narrower' : null;
    const wm = t.match(/(\d+)\s*(mm|cm)\s*(wide|width|planks?|boards?)/) || t.match(/\bplanks? (?:of|at|to) (\d+)\s*(mm|cm)/);
    const width = wm ? (wm[2] === 'cm' ? +wm[1] * 10 : +wm[1]) : null;
    const lm = t.match(/(\d+)\s*(mm|cm)\s*long/);
    if (!mat && !wider && width == null && !lm) return [call('ask_clarification', { question: 'What should change on the floor: the wood, the plank width or the plank length?' })];
    return [call('set_flooring', { material: mat, plank_width_mm: width, plank_width_change: width == null ? wider : null, plank_length_mm: lm ? (lm[2] === 'cm' ? +lm[1] * 10 : +lm[1]) : null })];
  }

  // Room walls (not the feature wall)
  if (/\b(walls|paint)\b/.test(t) && !/\b(feature|behind the bed|headboard|bed wall|centre|center|middle|left|right)\b/.test(t)) {
    const mat = materialIn(t, id => id === 'plaster_lime' || id === 'paint_wall');
    return [mat ? call('set_material', { element: 'walls', material: mat }) : call('ask_clarification', { question: 'The walls can be painted or finished in lime plaster. Which one?' })];
  }
  // Feature wall
  if (/\b(wall treatment|feature wall|headboard wall|behind the bed|cladding|wall)\b/.test(t) && !/\bwardrobe\b/.test(t)) {
    const zone = /\b(central|center|centre|middle)\b/.test(t) ? 'center' : /\bleft\b/.test(t) ? 'left' : /\bright\b/.test(t) ? 'right' : /\b(whole|entire|all|full|complete)\b/.test(t) ? 'all' : null;
    const treatment = /\b(wood(en)? panel|timber panel|veneer panel|large[- ]format|wood panelling|wood paneling)/.test(t) ? 'wood_panels'
      : /\b(flut|slat|batten|ribbed)/.test(t) ? 'fluted' : /\b(plaster|limewash|shelf)/.test(t) ? 'plaster_shelf' : /\b(travertine)\b/.test(t) && /\b(replace|change|make|use|switch)\b.*\btravertine\b/.test(t) ? 'travertine'
      : /\bpanels?\b/.test(t) ? 'wood_panels' : null;
    if (/\b(marble|onyx|brick|wallpaper)\b/.test(t) && !treatment) return [call('ask_clarification', { question: 'That wall finish is not in the library yet. I can use travertine, large-format wood panels, fluted oak or lime plaster with a shelf. Which one?' })];
    if (!treatment) return [call('ask_clarification', { question: 'Which treatment should the wall get: travertine, large-format wood panels, fluted oak or lime plaster with a shelf?' })];
    if (!zone) return [call('ask_clarification', { question: 'Which part of the feature wall: the centre, the left, the right or all of it?' })];
    const keep = /\b(retain|retaining|keep|keeping|leave|leaving)\b/.test(t) || zone !== 'all';
    const mat = treatment === 'travertine' ? materialIn(t, id => id.startsWith('travertine')) : treatment === 'wood_panels' ? materialIn(t, id => MATERIALS[id].grain === 'wood' && id !== 'oak_natural') : null;
    const pw = t.match(/(\d+)\s*(mm|cm)\s*(wide )?panels?/);
    return [call('set_wall_treatment', { zone, treatment, material: mat, panel_width_mm: pw ? (pw[2] === 'cm' ? +pw[1] * 10 : +pw[1]) : null, keep_other_zones: keep })];
  }

  // Dimensions
  const el = ELEMENT_WORDS.find(([re]) => re.test(t))?.[1];
  const dim = /\b(depth|deep|deeper|shallower)\b/.test(t) || /\b(push|pull|bring|move)\b.*\b(out|forward|back)\b/.test(t) ? 'depth' : /\b(width|wide|wider|narrower)\b/.test(t) ? 'width' : /\b(height|tall|taller|higher|lower|shorter)\b/.test(t) ? 'height' : /\b(length|long|longer)\b/.test(t) ? 'length' : null;
  if (el && dim) {
    const amt = amount(t);
    const down = /\b(decrease|reduce|shrink|shorten|lower|shallower|narrower|cut|less|smaller|trim)\b/.test(t);
    const changeWord = /\b(increase|decrease|reduce|add|extend|more|less|deeper|shallower|wider|narrower|taller|shorter|longer|higher|lower|by|push|pull|out|grow|shrink|extra|another|cut|trim)\b/.test(t);
    const toValue = (/\b(to|be|at)\s+\d/.test(t) && !/\bby\s+\d/.test(t)) || !changeWord;
    if (amt == null) return [call('ask_clarification', { question: `By how many millimetres should the ${el.replace('-', ' ')} ${dim} change?` })];
    return [call('change_dimension', { element: el, dimension: dim, delta_mm: toValue ? null : (down ? -Math.abs(amt) : Math.abs(amt)), value_mm: toValue ? amt : null, adjust_adjacent: true })];
  }
  if (el) {
    const mat = materialIn(t);
    if (mat && /\b(change|make|switch|set|finish|use|paint|swap|in|to)\b/.test(t)) return [call('set_material', { element: el, material: mat })];
  }
  if (/\badjust\b.*\b(adjacent|neighbou?ring|next|side)\b/.test(t) && ctx.last?.name === 'change_dimension') return [];
  return [call('ask_clarification', { question: 'I can change floor finishes and plank sizes, feature wall treatments, joinery and furniture dimensions and materials, propose alternatives, render, save and restore versions. What would you like to change?' })];
}

export function parse(text) {
  const t = String(text).toLowerCase().replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  const pieces = t.split(/(?<!\d)[.;](?!\d)\s*|\s+and then\s+|\s+then\s+|,\s+and\s+|,?\s+and\s+(?=(?:show|save|render|adjust|generate|change|make|increase|decrease|reduce|replace|keep|go|roll)\b)/).filter(s => s && s.trim());
  const calls = [];
  const ctx = {};
  for (const p of pieces) {
    for (const c of clause(p.trim(), ctx)) { calls.push(c); ctx.last = c; }
  }
  // One clarification is enough; drop it if real actions were found.
  const real = calls.filter(c => c.name !== 'ask_clarification');
  return real.length ? real : calls.slice(0, 1);
}
