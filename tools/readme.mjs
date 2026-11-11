// Writes README.md from the data files, so every number matches what the scripts measured.
import { readFileSync, writeFileSync } from 'node:fs';
const j = f => JSON.parse(readFileSync(f, 'utf8'));
const S = j('data/session.json'), V = j('data/verify.json'), R = j('data/recon.json'), E = j('data/parser-eval.json'), Q = j('data/quality.json');
const r1 = R.withDrawings.find(x => x.sigma === 1);
const rows = r1.rows.map(x => `| ${x.dimension} | ${x.truth} | ${R.withDrawings.map(rs => '±' + Math.round(rs.rows.find(y => y.dimension === x.dimension).p95Abs)).join(' | ')} |`).join('\n');
const shiftC = R.lensShift.assumeCentre.rows[0], shiftH = R.lensShift.fromHorizon.rows[0], nd = R.noDrawings.rows[0];
const files = V.files.map(f => `| ${f.file} | ${f.version} | ${f.objects} | ${f.closedSolids} | ${f.withUserText} | ${f.parity.maxDeviationMm} mm | ${f.ok ? 'pass' : 'FAIL'} |`).join('\n');
const turns = S.turns.filter(t => t.decision).map(t => `- **${t.text}** ${t.decision}: ${t.changes.join('; ')}${t.suggestion ? `. ${t.suggestion.text}` : ''}`).join('\n');
const ho = E.holdout, lh = Q.lighthouse;

writeFileSync('README.md', `# Rhino design agent: proof of concept

A sample bedroom, an editable Rhino model of it, and an agent that turns plain instructions into checked, approved
changes, saved as .3dm versions. Built against the five example instructions in the brief. The room, its dimensions
and its materials are invented; nothing here uses client files.

## Run it

\`\`\`
npm install
pip install rhino3dm --break-system-packages   # only for the Python checks
npm run measure      # export .3dm files, verify them in Python, Phase 1 test, parser eval, preview renders
npm run build        # static site in site-dist/
npm test             # Node unit tests and Python (rhino3dm) tests
npm run test:e2e     # browser tests against site-dist/
npm run serve        # http://localhost:4173/
node tools/deploy.mjs   # deploy/ folder for Vercel (noindex)
\`\`\`

Production language model: \`OPENAI_API_KEY=... OPENAI_MODEL=... node tools/eval-llm.mjs\` scores the OpenAI path on the
same instruction sets. Not run here.

## What is where

| Path | What it does |
|---|---|
| \`src/model/\` | Design spec, generator (spec to solid parts on layers), design checks, .3dm writer (rhino3dm) |
| \`src/agent/\` | Tool schemas (OpenAI strict functions), argument handling, offline parser, OpenAI adapter, session with approvals and versions |
| \`src/recon/\` | Phase 1: dimensions from one rendering (vanishing points, one known dimension) |
| \`rhino/\` | Runs in Rhino 8: Python generator, RhinoCommon functions, manual-edit detection, file verification. See \`rhino/README.md\` |
| \`src/site/\` | The demo page: three.js preview, instructions, proposals, versions, in-browser .3dm export |
| \`tools/\` | Measurement, build, screenshots, accessibility, Lighthouse, PDF, deploy |

## Measured vs not measured

### Measured

**Phase 1, dimensions from one rendering.** A test rendering is made from a model whose dimensions the method does
not see. ${R.points} points are clicked (all checked to be inside the image and not hidden by furniture), click error is added and the
dimensions are recovered, 2,000 times per error level. The ceiling height (2,900 mm) is the one dimension taken from
drawings. 95% of results fall within:

| Dimension | True (mm) | ${R.withDrawings.map(x => `${x.sigma} px`).join(' | ')} |
|---|---|${R.withDrawings.map(() => '---').join('|')}|
${rows}

- Positions measured from the west wall are weak because this camera sees it edge-on; wardrobe depth comes from the
  joinery drawing or a second view.
- No drawings, ceiling assumed 3,000 mm: room width off by ${Math.round(nd.meanErr)} mm on average.
- Lens shift of 12% with the image centre assumed: room width off by ${Math.round(shiftC.meanErr)} mm; principal point
  taken from the horizon: ${Math.abs(shiftH.meanErr).toFixed(1)} mm.

**.3dm files.** Written with rhino3dm (JavaScript), read back with rhino3dm (Python), rebuilt from the embedded spec by the
Python generator that runs in Rhino:

| File | Version | Objects | Closed solids | With user text | Rebuild difference | Result |
|---|---|---|---|---|---|---|
${files}

**The brief's instructions**, run through parser, checks and approvals (\`data/session.json\`):

${turns}

Rollback to Version 1 and back to Version 2 restores identical spec hashes.

**Instruction parsing (offline parser).** ${E.dev.correct}/${E.dev.total} on the phrasings it was written against.
Held-out phrasings, run once: ${ho.correct}/${ho.total} exact, ${ho.kinds.asked || 0} asked a question instead, ${ho.kinds.partial || 0} missed half of a two-part
instruction, ${ho.kinds.wrong || 0} disputed label.${E.history?.[0] ? ` An earlier held-out round scored ${E.history[0].correct}/${E.history[0].total} before tuning; those phrasings were then moved into the written set.` : ''}

**Manual-edit detection** on a real .3dm: a 50 mm move, a deleted object and an extra object are all reported.

**Tests and page quality.** ${Q.unit.passed} Node unit tests, ${Q.python.passed} Python tests, ${Q.e2e?.passed ?? '-'} browser tests (including a version
saved in the browser, downloaded and opened with Python rhino3dm). axe: ${Q.axe.violations} violations in ${Q.axe.scans} scans at 390, 820 and
1440 px. Lighthouse ${lh?.version} on mobile settings, median of 3: performance ${lh?.performance}, accessibility ${lh?.accessibility}, best practices
${lh?.bestPractices}, LCP ${lh?.lcpMs} ms, CLS ${lh?.cls}. SEO scores ${lh?.seo} because the demo is deliberately not indexable.

### Not measured

- Running inside Rhino 8 over MCP: \`rhino/design_tools.py\` is written against RhinoCommon but not executed (no Rhino
  licence here). Its logic (\`generator.py\`, \`sync.py\`) is tested outside Rhino.
- Real client renderings, which may be retouched, composited or use unknown lenses.
- OpenAI accuracy, latency and cost: needs an API key.
- Rhino Render output and timing. The images are three.js previews.
- Curved and freeform elements; this sample uses straight joinery and panels.

## Ownership

All code, models and documents produced for the project belong to the client.
`);
console.log('README.md written');
