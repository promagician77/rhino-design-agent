// 2-page brief (no price, no timeline), rendered by Chromium from the measured data. Writes build/rhino-design-agent.pdf.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { overlay } from '../src/site/page.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const j = p => JSON.parse(readFileSync(p, 'utf8'));
const S = j('data/session.json'), V = j('data/verify.json'), R = j('data/recon.json'), E = j('data/parser-eval.json'), Q = j('data/quality.json');
const f = p => 'file://' + resolve(p);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
mkdirSync('build', { recursive: true });

const r1 = R.withDrawings.find(x => x.sigma === 1);
const WEAK = 3;
const good = r1.rows.filter(x => x.p95Pct <= WEAK), weak = r1.rows.filter(x => x.p95Pct > WEAK);
const nd = R.noDrawings.rows[0], shC = R.lensShift.assumeCentre.rows[0], shH = R.lensShift.fromHorizon.rows[0];
const ho = E.holdout;
const blocked = S.turns.find(t => t.decision === 'blocked');
const v2 = V.files.find(x => x.file === 'Version-2.3dm');
const variants = S.turns.find(t => t.variants).variants;

const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><style>
@font-face{font-family:D;src:url(${f('site-dist/fonts/bodoni-moda-latin-500-normal.woff2')});font-weight:500}
@font-face{font-family:S;src:url(${f('site-dist/fonts/hanken-grotesk-latin-400-normal.woff2')});font-weight:400}
@font-face{font-family:S;src:url(${f('site-dist/fonts/hanken-grotesk-latin-600-normal.woff2')});font-weight:600}
@font-face{font-family:M;src:url(${f('site-dist/fonts/martian-mono-latin-400-normal.woff2')});font-weight:400}
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;font:400 8.7pt/1.42 S,Arial,sans-serif;color:#15181C;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;padding:11mm 13mm 9mm;background:#F3F4F1;position:relative;overflow:hidden;page-break-after:always}
.page:last-child{page-break-after:auto}
.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #15181C;padding-bottom:4px;margin-bottom:5mm}
.top b{font-weight:600}.top span{color:#4C5560;font-size:8pt}
h1{font:500 23pt/1.05 D;margin:0 0 3mm;max-width:165mm}
h2{font:500 13.5pt/1.1 D;margin:0 0 2mm}
h3{font:600 9pt/1.25 S;margin:0 0 1mm}
p{margin:0 0 2mm}
.lede{font-size:10pt;color:#4C5560;max-width:170mm;margin-bottom:4mm}
.sheet{background:#FCFCFA;border:1px solid #15181C;padding:3.5mm 5mm;margin-bottom:3mm}
.sh{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #15181C;padding-bottom:2mm;margin-bottom:3mm}
.tb{font:400 6.8pt M;border:1px solid #15181C;padding:1mm 2mm;color:#15181C;white-space:nowrap}
.cols{display:grid;grid-template-columns:1.15fr 1fr;gap:5mm;align-items:start}
.cols3{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
img{display:block;width:100%;height:auto;border:1px solid #C8CDD2}
.cap{font-size:7.3pt;color:#4C5560;margin-top:1.2mm}
ul{margin:0 0 2mm;padding-left:4mm}li{margin-bottom:1mm}
table{width:100%;border-collapse:collapse;font-size:7.6pt}
th,td{text-align:left;padding:1.1mm 2mm 1.1mm 0;border-bottom:1px solid #E1E4E6;vertical-align:top}
thead th{font-weight:600;color:#4C5560;border-bottom:1px solid #15181C}
.n{text-align:right;white-space:nowrap}
tr.weak th,tr.weak td{color:#9A5B00;font-weight:600}
.ov{position:relative}.ov svg{position:absolute;inset:0;width:100%;height:100%}
.ov line{stroke-width:4}.ov .ext line{stroke-width:2;stroke-dasharray:12 10;opacity:.7}.ov .x{stroke:#2A5DB0}.ov .y{stroke:#6E4A2F}.ov .z{stroke:#15181C;stroke-width:3}
.ov circle{fill:#fff;stroke:#2A5DB0;stroke-width:4}.ov text{display:none}
.flow{display:grid;grid-template-columns:repeat(5,1fr);gap:4mm;margin:1mm 0 3mm}
.node{border:1px solid #15181C;background:#fff;padding:1.6mm 2mm;font-size:7.3pt;position:relative}
.node b{display:block;font-size:8pt}.node span{color:#4C5560}
.node.rh{border-color:#2A5DB0;box-shadow:inset 0 0 0 1px #2A5DB0}
.node+.node:before{content:'';position:absolute;left:-4mm;top:50%;width:4mm;border-top:1px solid #15181C}
.flag{border-left:2px solid #A3261D;padding-left:2.5mm}
.kv{display:grid;grid-template-columns:auto 1fr;gap:.6mm 3mm;font-size:7.8pt}.kv dt{color:#4C5560}.kv dd{margin:0}
.mono{font:400 6.8pt M}
.foot{position:absolute;left:13mm;right:13mm;bottom:5mm;display:flex;justify-content:space-between;font-size:7pt;color:#4C5560}
.small{font-size:7.4pt;color:#4C5560}
.row5{display:grid;grid-template-columns:repeat(5,1fr);gap:2.5mm}.row5 img{aspect-ratio:3/2;object-fit:cover}
.hero{max-height:92mm;object-fit:contain;object-position:top left;background:#F3F4F1}
</style></head><body>
<section class="page">
  <div class="top"><div><b>Rhino design agent</b> <span>Proof of concept on a sample bedroom</span></div><span>James</span></div>
  <h1>The five instructions from your brief, applied to an editable Rhino model.</h1>
  <p class="lede">I built the proof of concept before writing this. A sample room is reconstructed from a rendering, the agent turns each instruction into typed tool calls, every change is checked and shown before it is applied, and each version is a .3dm file that opens in Rhino. Everything below was measured; what was not is listed on page 2.</p>
  <img class="hero" src="${f('shots/pdf-hero.png')}" alt="">
  <p class="cap">Instruction 3 in the demo: the wardrobe change is previewed with blue edges, its knock-on effects and checks listed, and nothing changes until Approve.</p>
  <div class="sheet" style="margin-top:4mm">
    <div class="sh"><h2>Phase 1. From a rendering to an editable model</h2><span class="tb">A-101 Measured on a test rendering</span></div>
    <div class="cols">
      <div>
        <div class="ov"><img src="${f('build/renders/Version-1-hero.webp')}" alt="">${overlay(R)}</div>
        <p class="cap">${R.points} clicked points, all checked to be visible. Edges along the two room axes give the vanishing points, the lens and the camera; the ceiling height from the drawings gives the scale.</p>
      </div>
      <div>
        <table><thead><tr><th>At 1 px click error, 95% within</th><th class="n">True</th><th class="n">±mm</th></tr></thead><tbody>
        ${r1.rows.map(x => `<tr${x.p95Pct > WEAK ? ' class="weak"' : ''}><th>${esc(x.dimension)}</th><td class="n">${x.truth.toLocaleString('en-GB')}</td><td class="n">${Math.round(x.p95Abs)}</td></tr>`).join('')}
        </tbody></table>
        <ul style="margin-top:2mm">
          <li>${good.length} of ${r1.rows.length} dimensions within ±${Math.max(...good.map(x => x.p95Pct)).toFixed(1)}%. Positions taken from the west wall, seen edge-on, are weak: wardrobe depth comes from the joinery drawing.</li>
          <li>Without drawings, a 3,000 mm ceiling guess makes the room ${Math.round(nd.meanErr)} mm too wide.</li>
          <li>Lens shift: ${Math.round(shC.meanErr)} mm error if the image centre is assumed, ${Math.abs(shH.meanErr).toFixed(1)} mm when taken from the horizon.</li>
        </ul>
      </div>
    </div>
  </div>
  <div class="foot"><span>Sample room and data are fictional</span><span>1 of 2</span></div>
</section>
<section class="page">
  <div class="top"><div><b>Rhino design agent</b> <span>Proof of concept on a sample bedroom</span></div><span>James</span></div>
  <div class="sheet">
    <div class="sh"><h2>Phase 2. The agent and the Rhino connection</h2><span class="tb">A-201 Built and tested outside Rhino</span></div>
    <div class="flow">
      <div class="node"><b>Designer</b><span>instruction, approve or reject</span></div>
      <div class="node"><b>OpenAI model</b><span>typed tool calls from 9 strict schemas, never code</span></div>
      <div class="node"><b>App</b><span>validates, applies to the spec, runs checks, shows the diff</span></div>
      <div class="node rh"><b>Rhino 8 over MCP</b><span>7 reviewed Python functions, one undo record per change</span></div>
      <div class="node"><b>Versions</b><span>.3dm with the spec inside, renders, rollback</span></div>
    </div>
    <div class="cols">
      <div>
        <p class="flag"><b>Risk in the plan:</b> in McNeel's Rhino AI, unchecking the destructive tools (scripts, save, run commands) only hides them from agents in Rhino's own panel. An external client connected over MCP still sees every tool. So GPT or Codex never connects to Rhino here; the app is the only MCP client and sends plain data to fixed functions.</p>
        <p>Checks before Rhino is touched: wardrobe depth range, plank width range, feature wall zones adding up, a 700 mm walkway to the bed, clashes, floor coverage. Example: <i>${esc(blocked.text)}</i> was blocked (walkway ${blocked.checks.walkway} mm) and the agent offered ${esc(blocked.suggestion.text.replace('The most that passes is ', ''))} instead.</p>
      </div>
      <div>
      <dl class="kv">
        <dt>Held-out phrasings</dt><dd>${ho.correct}/${ho.total} exact with the offline parser, run once; ${ho.kinds.asked || 0} asked a question, ${ho.kinds.partial || 0} partial, ${ho.kinds.wrong || 0} disputed label</dd>
        <dt>Written phrasings</dt><dd>${E.dev.correct}/${E.dev.total}</dd>
        <dt>OpenAI path</dt><dd>same tool schema; eval script ready, needs your key</dd>
      </dl>
        <p style="margin-top:2mm">Before every change the app checks for manual edits in Rhino: a 50 mm move, a deleted object and an extra object were all detected on a real .3dm.</p>
      </div>
    </div>
  </div>
  <div class="sheet">
    <div class="sh"><h2>Phase 3. Renders, options and versions</h2><span class="tb">A-301 Built; images are previews</span></div>
    <div class="row5">
      <div><img src="${f('build/renders/Version-1-hero.webp')}" alt=""><p class="cap">Version 1, reconstructed</p></div>
      <div><img src="${f('build/renders/Version-2-hero.webp')}" alt=""><p class="cap">Version 2: walnut 240 mm planks, oak panels between travertine, wardrobe ${v2.facts['wardrobe-carcass depth']} mm</p></div>
      ${variants.map(v => `<div><img src="${f(`build/renders/Variant-${v.key}-bed.webp`)}" alt=""><p class="cap">Option ${v.key}: ${esc(v.title)}</p></div>`).join('')}
    </div>
    <p class="small" style="margin-top:1mm">${V.files.length} .3dm files written, opened again with McNeel's rhino3dm in Python: millimetres, every object a closed solid on a named layer with element, part and material user text, and 0 mm difference when rebuilt from the embedded spec by the generator that runs in Rhino.</p>
  </div>
  <div class="cols" style="grid-template-columns:1fr 1fr">
    <div class="sheet" style="margin:0">
      <div class="sh"><h2>Phase 4. Tests, handover</h2><span class="tb">A-401</span></div>
      <table><tbody>
        <tr><th>One rendering reconstructed</th><td>method and error measured; yours in the PoC</td></tr>
        <tr><th>Agent connected</th><td>offline parser here; OpenAI and your Rhino 8 in the PoC</td></tr>
        <tr><th>Three conversational changes</th><td>instructions 1 to 3 approved, one blocked with a reason</td></tr>
        <tr><th>Updated visualisations</th><td>previews here; Rhino Render from saved views in the PoC</td></tr>
        <tr><th>Saved editable model</th><td>.3dm per version, read back and checked</td></tr>
      </tbody></table>
      <p class="small" style="margin-top:2mm">${Q.unit.passed} unit, ${Q.python.passed} Python and ${Q.e2e.passed} browser tests pass, including a version saved in the browser and opened with rhino3dm. Handover: source and tests, Rhino setup guide, material library and rules as files, recorded walkthrough and a training session. You own all of it.</p>
    </div>
    <div class="sheet" style="margin:0">
      <h3>Measured</h3>
      <ul class="small"><li>Dimension recovery on a synthetic rendering with known truth (2,000 runs per error level)</li><li>.3dm structure and rebuild; manual-edit detection</li><li>Instruction parsing; checks, approvals, versions and rollback</li></ul>
      <h3>Not measured</h3>
      <ul class="small"><li>Running inside Rhino 8 over MCP (no licence here; the Rhino functions are written, not run)</li><li>Real client renderings, OpenAI accuracy and cost, Rhino Render timing</li><li>Curved or freeform elements</li></ul>
      <h3>Sources</h3>
      <ul class="small"><li>rhino3d.com/for/ai: tool groups and MCP clients</li><li>docs.mcneel.com: Rhino 9 AI command and AI Settings</li><li>discourse.mcneel.com: RhinoAI beta feature</li></ul>
    </div>
  </div>
  <div class="foot"><span>Sample room and data are fictional</span><span>2 of 2</span></div>
</section>
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage();
writeFileSync('build/brief.html', html);
await p.goto(f('build/brief.html'), { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map(pg => pg.scrollHeight - pg.clientHeight));
await p.pdf({ path: 'build/rhino-design-agent.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await b.close();
console.log('pdf written; page overflow px:', over.join(', '));
