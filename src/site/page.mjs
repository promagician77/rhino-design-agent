// Static page for the demo. Every number on it comes from the data files written by the measurement scripts.
import { project, TEST_CAMERA } from '../recon/metrology.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mm = v => `${Math.round(v).toLocaleString('en-GB')} mm`;
const kb = b => b > 1e6 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

export const BRIEF = [
  'Change the bedroom flooring to light walnut with wider planks.',
  'Replace the central wall treatment with large-format wood panels while retaining travertine on either side.',
  'Increase the wardrobe depth by 100 mm and adjust the adjacent cabinetry.',
  'Generate three alternative designs for the feature wall.',
  'Show me the updated rendering and save this as Version 2.',
];

function sheet(no, title, status, body, id) {
  return `<section class="sheet" id="${id}" aria-labelledby="${id}-t">
  <header class="sheet-head"><h2 id="${id}-t">${title}</h2>
    <dl class="tb"><div><dt>Sheet</dt><dd>${no}</dd></div><div><dt>Status</dt><dd>${status}</dd></div></dl></header>
  ${body}
</section>`;
}

export function overlay(recon) {
  const P = x => project(TEST_CAMERA, x);
  const plan = recon.plan;
  const seg = (a, b, cls) => { const p = P(a), q = P(b); return `<line class="${cls}" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`; };
  // Extend each clicked edge far along its direction so the lines visibly converge toward the vanishing points.
  const ext = (a, b, cls) => { const p = P(a), q = P(b); const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy); const f = 3000 / L; return `<line class="${cls}" x1="${(p[0] - dx * f).toFixed(1)}" y1="${(p[1] - dy * f).toFixed(1)}" x2="${(q[0] + dx * f).toFixed(1)}" y2="${(q[1] + dy * f).toFixed(1)}"/>`; };
  const dot = (x, label) => { const p = P(x); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7"/>${label ? `<text x="${(p[0] + 12).toFixed(1)}" y="${(p[1] - 10).toFixed(1)}">${label}</text>` : ''}`; };
  return `<svg class="overlay" viewBox="0 0 1600 1000" role="img" aria-label="Clicked edges and corners on the test rendering. Edges along the room's two axes are extended toward their vanishing points.">
  <g class="ext">${plan.linesX.map(([a, b]) => ext(a, b, 'x')).join('')}${plan.linesY.map(([a, b]) => ext(a, b, 'y')).join('')}</g>
  <g class="seg">${plan.linesX.map(([a, b]) => seg(a, b, 'x')).join('')}${plan.linesY.map(([a, b]) => seg(a, b, 'y')).join('')}${Object.values(plan.verticals).map(([a, b]) => seg(a, b, 'z')).join('')}</g>
  <g class="pts">${dot(plan.origin, 'origin')}${dot(plan.originTop, 'ceiling 2,900 (drawing)')}${Object.values(plan.floor).map(x => dot(x)).join('')}${Object.values(plan.ceiling).map(x => dot(x)).join('')}${Object.values(plan.verticals).map(([, b]) => dot(b)).join('')}</g>
</svg>`;
}

export function render(d) {
  const { session: S, verify: V, recon: R, parser: E, quality: Q } = d;
  const r1 = R.withDrawings.find(x => x.sigma === 1), r2 = R.withDrawings.find(x => x.sigma === 2);
  const row = (rs, k) => rs.rows.find(x => x.dimension === k);
  const wardrobe1 = row(r1, 'Wardrobe front from wall');
  const WEAK = 3; // per cent, at 1 px
  const goodRows = r1.rows.filter(x => x.p95Pct <= WEAK), weakRows = r1.rows.filter(x => x.p95Pct > WEAK);
  const worstGood = Math.max(...goodRows.map(x => x.p95Pct));
  const shiftC = row(R.lensShift.assumeCentre, 'Room width (wall to wall)'), shiftH = row(R.lensShift.fromHorizon, 'Room width (wall to wall)');
  const noDraw = row(R.noDrawings, 'Room width (wall to wall)');
  const v2 = V.files.find(f => f.file === 'Version-2.3dm'), v1 = V.files.find(f => f.file === 'Version-1.3dm');
  const allOk = V.files.every(f => f.ok);
  const T = S.turns;
  const blocked = T.find(t => t.decision === 'blocked');
  const ho = E.holdout, h1 = E.history?.[0];

  const reconTable = `<table class="data recon"><caption>Recovered from the test rendering, 2,000 repeats per click error. <span class="cap2">95% of results fall within the ± value.</span></caption>
  <thead><tr><th scope="col">Dimension</th><th scope="col" class="n">True</th>${R.withDrawings.map(x => `<th scope="col" class="n">${x.sigma} px</th>`).join('')}</tr></thead>
  <tbody>${r1.rows.map(x => `<tr${x.p95Pct > WEAK ? ' class="weak"' : ''}><th scope="row">${esc(x.dimension)}</th><td class="n">${x.truth.toLocaleString('en-GB')}</td>${R.withDrawings.map(rs => { const y = row(rs, x.dimension); return `<td class="n">±${Math.round(y.p95Abs)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;

  const layerCounts = Object.entries(v1.byLayer).sort();
  const layerTree = `<ul class="layers" aria-label="Layer tree of Version-1.3dm as read back by rhino3dm">${layerCounts.map(([p, n]) => { const parts = p.split('::'); return `<li style="--d:${parts.length - 2}"><span>${esc(parts.slice(1).join(' / '))}</span><b>${n}</b></li>`; }).join('')}</ul>`;

  const files = `<table class="data files"><caption>Every file opened again with McNeel's rhino3dm reader (Python) and rebuilt from its own embedded spec by the Python generator that runs in Rhino.</caption>
  <thead><tr><th scope="col">File</th><th scope="col">Version</th><th scope="col" class="n">Objects</th><th scope="col" class="n">Closed solids</th><th scope="col" class="n">With user text</th><th scope="col" class="n">Rebuild difference</th><th scope="col" class="n">Size</th><th scope="col"><span class="vh">Download</span></th></tr></thead>
  <tbody>${[...V.files].sort((a, b) => (a.file.startsWith('Version') ? 0 : 1) - (b.file.startsWith('Version') ? 0 : 1) || a.file.localeCompare(b.file)).map(f => { const s = S.files.find(x => x.file === f.file); return `<tr><th scope="row">${f.file}</th><td>${esc(f.version)}${s?.note ? `<span class="sub">${esc(s.note)}</span>` : ''}</td><td class="n">${f.objects}</td><td class="n">${f.closedSolids}</td><td class="n">${f.withUserText}</td><td class="n">${f.parity.maxDeviationMm} mm</td><td class="n">${kb(s?.bytes || 0)}</td><td><a class="dl" href="models/${f.file}" download>.3dm</a></td></tr>`; }).join('')}</tbody></table>`;

  const tools = [
    ['set_flooring', 'Wood, plank width (or the next stock width for "wider"), plank length'],
    ['set_wall_treatment', 'Left, centre, right or all of the feature wall: travertine, wood panels, fluted oak, plaster with shelf'],
    ['change_dimension', 'Depth, width, height or length of joinery and furniture, by an amount or to a value'],
    ['set_material', 'Material of an element, from the studio library only'],
    ['generate_variants', 'Up to four checked alternatives for the feature wall'],
    ['render_view', 'Hero, bed, wardrobe or plan view'],
    ['save_version', 'Writes the approved model as a new .3dm with its spec inside'],
    ['rollback', 'Restores a saved version'],
    ['ask_clarification', 'Used for anything unclear, unsupported or destructive'],
  ];

  const turns = T.filter(t => t.changes?.length).map(t => `<li><p class="q">${esc(t.text)}</p><ul class="ch">${t.changes.map(c => `<li>${esc(c)}</li>`).join('')}${t.consequences.map(c => `<li class="k">${esc(c)}</li>`).join('')}</ul><p class="res ${t.decision}">${t.decision === 'approved' ? `Approved. Rhino: ${t.diff.added} added, ${t.diff.removed} removed, ${t.diff.changed} changed.` : `Blocked: ${esc(t.checks.issues.map(i => i.msg).join('; '))}. ${esc(t.suggestion?.text || '')}`}</p></li>`).join('');

  const q = Q || {};
  const qrow = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Rhino design agent: proof of concept on a sample bedroom</title>
<meta name="description" content="Natural-language edits to an editable Rhino model: reconstruction from a rendering, typed AI tool calls, approvals, versions and verified .3dm files.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preload" href="fonts/bodoni-moda-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/hanken-grotesk-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="app.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="strip">
  <p class="proj"><b>Master bedroom, sample villa</b><span>Proof of concept for the Rhino design agent brief</span></p>
  <nav aria-label="Sheets"><ol>
    <li><a href="#model">A-000 Model and agent</a></li><li><a href="#phase1">A-101 Reconstruction</a></li><li><a href="#phase2">A-201 Agent and Rhino</a></li><li><a href="#phase3">A-301 Interface and versions</a></li><li><a href="#phase4">A-401 Testing and handover</a></li>
  </ol></nav>
</header>
<main id="main">
<section class="hero" id="model" aria-labelledby="hero-t">
  <div class="hero-text">
    <h1 id="hero-t">Type the change. Approve it. Open the .3dm.</h1>
    <p class="lede">The five instructions from your brief, running against an editable model of a sample bedroom: every edit is shown before it is applied, checked against simple design rules, saved as a version and written as a Rhino file you can open.</p>
  </div>
  <div class="work">
    <div class="left">
    <div class="viewport">
      <div class="vp-bar">
        <div class="views" role="group" aria-label="View"><button type="button" data-view="hero" aria-pressed="true">Perspective</button><button type="button" data-view="bed" aria-pressed="false">Bed wall</button><button type="button" data-view="wardrobe" aria-pressed="false">Wardrobe</button><button type="button" data-view="plan" aria-pressed="false">Plan</button></div>
        <p class="vp-state" id="vp-state" aria-live="polite">Version 1</p>
      </div>
      <div class="canvas-wrap">
        <img class="poster" src="renders/Version-1-hero.webp" alt="" width="1600" height="1000" fetchpriority="high">
        <canvas id="view" tabindex="0" aria-label="3D view of the bedroom model. Drag to orbit, scroll to zoom, click an object to see its Rhino properties."></canvas>
        <div class="props" id="props" hidden></div>
      </div>
      <p class="vp-note">Point at the view to make it live, then drag to orbit. Click any object for the properties Rhino will show. Blue edges mark what a pending change touches.</p>
    </div>
  <div class="versions" aria-labelledby="ver-t"><h2 id="ver-t">Versions</h2><ol id="versions" data-prebuilt="${esc(JSON.stringify(Object.fromEntries(S.files.map(f => [f.hash, f.file]))))}"></ol></div>
    </div>
    <div class="chat" aria-labelledby="chat-t">
      <h2 id="chat-t" class="chat-h">Instructions</h2>
      <ol class="chips" aria-label="Instructions from the brief">${BRIEF.map((b, i) => `<li><button type="button" class="chip" data-say="${esc(b)}"><span class="no">${i + 1}</span>${esc(b)}</button></li>`).join('')}
        <li><button type="button" class="chip alt" data-say="Increase the wardrobe depth by another 300 mm."><span class="no">+</span>Increase the wardrobe depth by another 300 mm.</button></li>
      </ol>
      <div class="log" id="log" role="log" aria-live="polite" aria-label="Conversation"></div>
      <form class="ask" id="ask"><label for="say" class="vh">Instruction</label><input id="say" name="say" autocomplete="off" placeholder="For example: make the bed 200 mm wider"><button type="submit">Send</button></form>
      <p class="engine">Offline parser in this demo; production sends the same tool schema to OpenAI.</p>
    </div>
  </div>

</section>

${sheet('A-101', 'Phase 1. From a rendering to an editable model', 'Measured on a test rendering', `
<div class="cols">
  <figure class="figure">
    <div class="ov-wrap"><img src="renders/Version-1-hero.webp" alt="Test rendering of the sample bedroom: wardrobe on the left, bed against a travertine feature wall, pendants either side." width="1600" height="1000" loading="lazy">${overlay(R)}</div>
    <figcaption>The test rendering, made from a model whose true dimensions are hidden from the method. Blue: edges along the room width. Walnut: edges along the room depth. Dots: corners clicked for measurement.</figcaption>
  </figure>
  <div class="prose">
    <p>A designer clicks about ${R.points} points on the rendering. Edges that run along the two room axes meet at two vanishing points, which give the lens and the camera angle. One dimension from your drawings (here the ceiling height) sets the scale. Everything else is then placed in millimetres.</p>
    <ul class="findings">
      <li><b>With one true dimension</b>, ${goodRows.length} of the ${r1.rows.length} dimensions come back within ±${worstGood.toFixed(1)}% at one pixel of click error.</li>
      <li><b>Anything measured from the west wall is weak</b>, because this camera sees that wall edge-on behind the wardrobe: ${weakRows.map(x => `${x.dimension.toLowerCase()} ±${Math.round(x.p95Abs)} mm`).join(', ')}. Wardrobe depth is the dimension instruction 3 changes, so it comes from the joinery drawing or a second view, not from the image.</li>
      <li><b>Without drawings</b>, every dimension scales with the guess: assuming a 3,000 mm ceiling instead of 2,900 makes the room ${Math.round(noDraw.meanErr)} mm too wide.</li>
      <li><b>Lens shift</b>, often used to keep verticals straight, skews the result by ${Math.round(shiftC.meanErr)} mm on the room width if the image centre is assumed; taking the centre from the horizon brings it back to ${Math.abs(shiftH.meanErr).toFixed(0)} mm.</li>
    </ul>
  </div>
</div>
${reconTable}
<div class="cols">
  <div class="prose">
    <h3>The model behind Version 1</h3>
    <p>The measurements fill one design spec: room, openings, flooring, three feature-wall zones, wardrobe and the units beside it, bed, bedside tables, rug and lights. A generator turns the spec into ${v1.objects} closed solids on named layers, with the studio's material names and the parameters stored on each object as Rhino user text. The same spec is stored inside the .3dm, so any saved version can be rebuilt or edited later.</p>
    <p><a class="dl big" href="models/Version-1.3dm" download>Download Version-1.3dm</a></p>
  </div>
  <div><h3 class="small">Layers in Version-1.3dm, with object counts</h3>${layerTree}</div>
</div>`, 'phase1')}

${sheet('A-201', 'Phase 2. The agent and the Rhino connection', 'Built and tested outside Rhino', `
<div class="arch" role="img" aria-label="Flow: the designer writes an instruction; the language model returns typed tool calls; the app validates them and runs design checks; the designer approves; the app calls fixed Python functions inside Rhino 8 through the Rhino MCP server; Rhino writes the version file and renders.">
  <div class="node you"><b>Designer</b><span>writes an instruction, approves or rejects</span></div>
  <div class="node"><b>OpenAI model</b><span>returns typed tool calls from ${tools.length} strict schemas; never code</span></div>
  <div class="node"><b>App</b><span>validates, applies to the spec, runs the design checks, shows the diff</span></div>
  <div class="node rh"><b>Rhino 8</b><span>fixed functions over Rhino MCP: bake, capture, save version, restore, check for manual edits</span></div>
  <div class="node"><b>Versions</b><span>.3dm with the spec inside, renders, rollback</span></div>
</div>
<div class="cols">
  <div class="prose">
    <h3>Why the model gets tools, not Rhino</h3>
    <p>McNeel's Rhino AI groups its tools as read-only, modify and destructive, and running scripts or saving files sit in the destructive group. Unchecking a group only hides it from agents inside Rhino's own panel; an external client connected over MCP still sees every tool. So in this design the app is the only MCP client. The model can only ask for the ${tools.length} actions below, the app checks every argument, and Rhino runs one of ${7} reviewed Python functions with plain data. The script line sent to Rhino carries the arguments as base64, so a crafted label cannot become code.</p>
    <p>Codex belongs in development: writing new tool functions and their tests. It is not given the client's file at run time.</p>
    <h3>Checks before anything reaches Rhino</h3>
    <p>Wardrobe depth range, plank width range, feature wall zones adding up to the wall, a 700 mm walkway between joinery and the bed, clashes between solids, and floor coverage. When a change fails, the agent says why and proposes the largest change that passes.</p>
    <p class="example"><span class="q">${esc(blocked.text)}</span> ${esc(blocked.checks.issues.map(i => i.msg).join('; '))}. ${esc(blocked.suggestion.text)}</p>
  </div>
  <div>
    <table class="data tools"><caption>The only actions the model can request</caption><thead><tr><th scope="col">Tool</th><th scope="col">What it does</th></tr></thead>
    <tbody>${tools.map(([n, w]) => `<tr><th scope="row"><code>${n}</code></th><td>${esc(w)}</td></tr>`).join('')}</tbody></table>
    <h3 class="small">How well instructions become tool calls</h3>
    <dl class="kv">
      ${qrow('Offline parser, held-out phrasings (run once)', `${ho.correct} of ${ho.total} exact; ${ho.kinds.asked || 0} asked a question instead, ${ho.kinds.partial || 0} missed part of a two-part instruction, ${ho.kinds.wrong || 0} disputed label`)}
      ${h1 ? qrow('Earlier held-out round, before tuning', `${h1.correct} of ${h1.total}`) : ''}
      ${qrow('Phrasings it was written against', `${E.dev.correct} of ${E.dev.total}`)}
      ${qrow('OpenAI path', 'Same tool schema, eval script included; not run here (no API key in the demo)')}
    </dl>
  </div>
</div>
<div class="prose wide">
  <h3>The brief's instructions, as the agent handled them</h3>
  <ul class="turns">${turns}</ul>
</div>`, 'phase2')}

${sheet('A-301', 'Phase 3. Interface, renders and versions', 'Built; renders are previews', `
<div class="compare" id="compare">
  <img src="renders/Version-1-hero.webp" alt="Version 1: oak floor and travertine feature wall." width="1600" height="1000" loading="lazy">
  <div class="after"><img src="renders/Version-2-hero.webp" alt="Version 2: light walnut floor with wider planks, smoked oak panels in the centre of the feature wall, deeper wardrobe." width="1600" height="1000" loading="lazy"></div>
  <label class="slider"><span class="vh">Compare Version 1 and Version 2</span><input type="range" min="0" max="100" value="50" id="cmp"></label>
  <span class="tag l">Version 1</span><span class="tag r">Version 2</span>
</div>
<p class="figcap">Drag to compare. Version 2 is the result of instructions 1 to 3 and 5.</p>
<div class="options">${T.find(t => t.variants).variants.map(v => `<figure><img src="renders/Variant-${v.key}-bed.webp" alt="Option ${v.key}: ${esc(v.title)}" width="900" height="600" loading="lazy"><figcaption><b>Option ${v.key}</b> ${esc(v.title)}<span>${v.parts} objects, checks passed, walkway ${v.walkway} mm. <a href="models/Variant-${v.key}.3dm" download>Variant-${v.key}.3dm</a></span></figcaption></figure>`).join('')}</div>
<p class="figcap">Instruction 4: three alternatives for the feature wall, each checked and saved as its own file.</p>
${files}
<p class="note">${allOk ? 'All files pass' : 'Not all files pass'}: millimetre units, every object a closed solid with element, part and material user text, and a rebuild difference of ${Math.max(...V.files.map(f => f.parity.maxDeviationMm))} mm between the file and the Python generator. In Version 2 the wardrobe reads ${v2.facts['wardrobe-carcass depth']} mm deep, the tall unit ${v2.facts['tall-unit depth']} mm and the drawer unit ${v2.facts['drawer-unit depth']} mm; planks are ${v2.facts['plank width']} mm in ${esc(v2.facts['floor material'])}.</p>`, 'phase3')}

${sheet('A-401', 'Phase 4. Testing, handover and the proof of concept', 'Measured', `
<div class="cols">
  <div>
    <table class="data poc"><caption>The paid proof of concept in the brief, and where each part stands in this demo</caption>
    <thead><tr><th scope="col">Brief</th><th scope="col">In this demo</th><th scope="col">In your PoC</th></tr></thead><tbody>
      <tr><th scope="row">One rendering reconstructed</th><td>Test rendering, errors measured (A-101)</td><td>Your rendering and drawings</td></tr>
      <tr><th scope="row">Agent connected</th><td>Offline parser; Rhino functions tested outside Rhino</td><td>OpenAI and your Rhino 8 over MCP</td></tr>
      <tr><th scope="row">Three or more conversational changes</th><td>Instructions 1 to 3 approved, one blocked with a reason</td><td>The same five instructions on your room</td></tr>
      <tr><th scope="row">Updated visualisations</th><td>three.js previews</td><td>Rhino Render from saved views</td></tr>
      <tr><th scope="row">Saved editable model</th><td>${V.files.length} .3dm files, read back and checked</td><td>.3dm per version in your project folder</td></tr>
    </tbody></table>
  </div>
  <div>
    <h3 class="small">Tests and quality of this page</h3>
    <dl class="kv">
      ${qrow('Unit tests (Node)', q.unit ? `${q.unit.passed} passed` : 'see README')}
      ${qrow('Rhino-side tests (Python, rhino3dm)', q.python ? `${q.python.passed} passed` : 'see README')}
      ${qrow('Browser tests', q.e2e ? `${q.e2e.passed} passed` : 'see README')}
      ${qrow('Accessibility (axe) at 390, 820, 1440 px', q.axe ? `${q.axe.violations} violations` : 'see README')}
      ${qrow('Lighthouse on mobile settings, median of 3', q.lighthouse ? `Performance ${q.lighthouse.performance}, accessibility ${q.lighthouse.accessibility}, best practices ${q.lighthouse.bestPractices}` : 'see README')}
    </dl>
    <h3 class="small">Handover</h3>
    <ul class="plain"><li>Source with tests, the Rhino Python functions and the setup guide for Rhino MCP</li><li>Material library and design rules as editable files</li><li>Recorded walkthrough and a live training session for the design team</li><li>All code, models and documents owned by you</li></ul>
  </div>
</div>`, 'phase4')}

<section class="notes" aria-labelledby="notes-t">
  <h2 id="notes-t">What is measured here, and what is not</h2>
  <div class="cols">
    <div><h3 class="small">Measured</h3><ul class="plain">
      <li>Dimension recovery on a synthetic rendering with known truth, 2,000 repeats per click-error level</li>
      <li>.3dm files: units, layers, closed solids, user text, embedded spec, rebuild by the Python generator (0 mm)</li>
      <li>Manual-edit detection on a real .3dm: a 50 mm move, a deleted object and an extra object</li>
      <li>Instruction parsing on ${E.dev.total} written and ${ho.total} held-out phrasings</li>
      <li>Design checks, approvals, versions and rollback (hashes match after restore)</li>
    </ul></div>
    <div><h3 class="small">Not measured</h3><ul class="plain">
      <li>Running inside Rhino 8 over MCP: no Rhino licence in this environment</li>
      <li>Real client renderings, which can be retouched or composited</li>
      <li>OpenAI accuracy and cost: the eval script is ready but needs your key</li>
      <li>Rhino Render output and timing; images here are three.js previews</li>
      <li>Curved or freeform elements: this sample uses straight joinery and panels</li>
    </ul></div>
  </div>
  <p class="src">Sources: McNeel, <a href="https://www.rhino3d.com/for/ai/">Rhino and artificial intelligence</a> (tool groups and MCP clients); McNeel, <a href="https://docs.mcneel.com/rhino/9/help/en-us/commands/ai.htm">AI command and AI Settings</a>; McNeel forum, <a href="https://discourse.mcneel.com/t/rhino-beta-feature-rhinoai/223146">RhinoAI beta feature</a>. The bedroom, its dimensions and materials are invented for this demo.</p>
</section>
</main>
<footer class="foot"><p>Sample room and data are fictional. Not indexed by search engines.</p></footer>
<script type="module" src="app.js"></script>
</body>
</html>`;
}

export function render404() {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not found</title><link rel="stylesheet" href="app.css"></head><body><main class="nf"><h1>That sheet does not exist.</h1><p><a href="./">Back to the model</a></p></main></body></html>`;
}
