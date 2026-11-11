# Rhino design agent: proof of concept

A sample bedroom, an editable Rhino model of it, and an agent that turns plain instructions into checked, approved
changes, saved as .3dm versions. Built against the five example instructions in the brief. The room, its dimensions
and its materials are invented; nothing here uses client files.

## Run it

```
npm install
pip install rhino3dm --break-system-packages   # only for the Python checks
npm run measure      # export .3dm files, verify them in Python, Phase 1 test, parser eval, preview renders
npm run build        # static site in site-dist/
npm test             # Node unit tests and Python (rhino3dm) tests
npm run test:e2e     # browser tests against site-dist/
npm run serve        # http://localhost:4173/
node tools/deploy.mjs   # deploy/ folder for Vercel (noindex)
```

Production language model: `OPENAI_API_KEY=... OPENAI_MODEL=... node tools/eval-llm.mjs` scores the OpenAI path on the
same instruction sets. Not run here.

## What is where

| Path | What it does |
|---|---|
| `src/model/` | Design spec, generator (spec to solid parts on layers), design checks, .3dm writer (rhino3dm) |
| `src/agent/` | Tool schemas (OpenAI strict functions), argument handling, offline parser, OpenAI adapter, session with approvals and versions |
| `src/recon/` | Phase 1: dimensions from one rendering (vanishing points, one known dimension) |
| `rhino/` | Runs in Rhino 8: Python generator, RhinoCommon functions, manual-edit detection, file verification. See `rhino/README.md` |
| `src/site/` | The demo page: three.js preview, instructions, proposals, versions, in-browser .3dm export |
| `tools/` | Measurement, build, screenshots, accessibility, Lighthouse, PDF, deploy |

## Measured vs not measured

### Measured

**Phase 1, dimensions from one rendering.** A test rendering is made from a model whose dimensions the method does
not see. 29 points are clicked (all checked to be inside the image and not hidden by furniture), click error is added and the
dimensions are recovered, 2,000 times per error level. The ceiling height (2,900 mm) is the one dimension taken from
drawings. 95% of results fall within:

| Dimension | True (mm) | 0.5 px | 1 px | 2 px | 3 px |
|---|---|---|---|---|---|
| Room width (wall to wall) | 4800 | ±42 | ±83 | ±166 | ±260 |
| Wardrobe front from wall | 620 | ±66 | ±136 | ±274 | ±419 |
| Wardrobe run to feature wall | 3680 | ±16 | ±32 | ±64 | ±96 |
| Wardrobe height | 2700 | ±23 | ±47 | ±97 | ±149 |
| Bed width | 1900 | ±18 | ±36 | ±75 | ±109 |
| Bed + headboard length | 2230 | ±17 | ±32 | ±64 | ±95 |
| Bed centre from west wall | 2400 | ±52 | ±103 | ±207 | ±325 |
| Bed height | 320 | ±5 | ±9 | ±18 | ±27 |
| Travertine slab width | 600 | ±8 | ±15 | ±31 | ±46 |
| Travertine slab height | 1200 | ±4 | ±9 | ±17 | ±26 |

- Positions measured from the west wall are weak because this camera sees it edge-on; wardrobe depth comes from the
  joinery drawing or a second view.
- No drawings, ceiling assumed 3,000 mm: room width off by 167 mm on average.
- Lens shift of 12% with the image centre assumed: room width off by 320 mm; principal point
  taken from the horizon: 0.1 mm.

**.3dm files.** Written with rhino3dm (JavaScript), read back with rhino3dm (Python), rebuilt from the embedded spec by the
Python generator that runs in Rhino:

| File | Version | Objects | Closed solids | With user text | Rebuild difference | Result |
|---|---|---|---|---|---|---|
| Variant-A.3dm | Option A | 205 | 205 | 205 | 0 mm | pass |
| Variant-B.3dm | Option B | 147 | 147 | 147 | 0 mm | pass |
| Variant-C.3dm | Option C | 136 | 136 | 136 | 0 mm | pass |
| Version-1.3dm | Version 1 | 184 | 184 | 184 | 0 mm | pass |
| Version-2.3dm | Version 2 | 146 | 146 | 146 | 0 mm | pass |

**The brief's instructions**, run through parser, checks and approvals (`data/session.json`):

- **Change the bedroom flooring to light walnut with wider planks.** approved: flooring material: Oak natural → Walnut light; plank width (mm): 180 → 240
- **Replace the central wall treatment with large-format wood panels while retaining travertine on either side.** approved: center zone treatment: travertine → large-format wood panels; center zone material: Travertine classic → Smoked oak veneer
- **Increase the wardrobe depth by 100 mm and adjust the adjacent cabinetry.** approved: wardrobe depth (mm): 600 → 700
- **Increase the wardrobe depth by another 300 mm.** blocked: wardrobe depth (mm): 700 → 1000. The most that passes is +30 mm.

Rollback to Version 1 and back to Version 2 restores identical spec hashes.

**Instruction parsing (offline parser).** 50/50 on the phrasings it was written against.
Held-out phrasings, run once: 14/20 exact, 4 asked a question instead, 1 missed half of a two-part
instruction, 1 disputed label. An earlier held-out round scored 12/20 before tuning; those phrasings were then moved into the written set.

**Manual-edit detection** on a real .3dm: a 50 mm move, a deleted object and an extra object are all reported.

**Tests and page quality.** 20 Node unit tests, 6 Python tests, 7 browser tests (including a version
saved in the browser, downloaded and opened with Python rhino3dm). axe: 0 violations in 15 scans at 390, 820 and
1440 px. Lighthouse 13.6.0 on mobile settings, median of 3: performance 98, accessibility 100, best practices
100, LCP 2381 ms, CLS 0. SEO scores 66 because the demo is deliberately not indexable.

### Not measured

- Running inside Rhino 8 over MCP: `rhino/design_tools.py` is written against RhinoCommon but not executed (no Rhino
  licence here). Its logic (`generator.py`, `sync.py`) is tested outside Rhino.
- Real client renderings, which may be retouched, composited or use unknown lenses.
- OpenAI accuracy, latency and cost: needs an API key.
- Rhino Render output and timing. The images are three.js previews.
- Curved and freeform elements; this sample uses straight joinery and panels.

## Ownership

All code, models and documents produced for the project belong to the client.
