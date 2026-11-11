// Browser tests against the built site (site-dist), in Chromium with software WebGL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { join } = require('node:path');
const os = require('node:os');

const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let srv, browser, base;
before(async () => {
  const { serve } = await import('../../tools/serve.mjs');
  srv = await serve('site-dist', 0); base = `http://localhost:${srv.port}/`;
  browser = await chromium.launch({ args: GL });
});
after(async () => { await browser.close(); await srv.close(); });

async function open(vw = 1440, vh = 900) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, acceptDownloads: true });
  const errors = [], foreign = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url()); });
  await page.goto(base, { waitUntil: 'load' });
  await page.hover('#view'); await page.waitForSelector('.canvas-wrap.live', { timeout: 60000 });
  return { page, errors, foreign };
}
const chip = (page, i) => page.locator('.chip').nth(i).click();
const approve = page => page.locator('.proposal button.primary').last().click();

test('loads with the 3D view, no console errors and no requests to other sites', async () => {
  const { page, errors, foreign } = await open();
  assert.equal(await page.locator('#vp-state').textContent(), 'Version 1');
  assert.equal(await page.locator('#versions li').count(), 1);
  assert.deepEqual(errors, []); assert.deepEqual(foreign, []);
  await page.close();
});

test('a proposal changes nothing until approved, and reject keeps the model', async () => {
  const { page } = await open();
  await chip(page, 0);
  const prop = page.locator('.proposal').last();
  assert.match(await prop.textContent(), /Oak natural → Walnut light/);
  assert.match(await prop.textContent(), /180 → 240/);
  assert.equal(await page.locator('#vp-state').textContent(), 'Preview of the pending change');
  await prop.getByRole('button', { name: 'Reject' }).click();
  assert.equal(await page.locator('#vp-state').textContent(), 'Version 1');
  await chip(page, 0); await approve(page);
  assert.match(await page.locator('#vp-state').textContent(), /with approved changes/);
  await page.close();
});

test('the brief end to end: blocked change with a working suggestion, variants, Version 2, restore', async () => {
  const { page, errors } = await open();
  for (const i of [0, 1, 2]) { await chip(page, i); await approve(page); }
  await chip(page, 5);
  const blocked = page.locator('.proposal.blocked').last();
  assert.match(await blocked.textContent(), /below the 700 mm minimum/);
  await blocked.getByRole('button', { name: 'Try +30 mm' }).click();
  assert.match(await page.locator('.proposal').last().textContent(), /700 → 730/);
  await page.locator('.proposal').last().getByRole('button', { name: 'Reject' }).click();
  await chip(page, 3);
  await page.waitForFunction(() => { const i = [...document.querySelectorAll('.vars img')]; return i.length === 3 && i.every(x => x.src.startsWith('data:image')); }, null, { timeout: 60000 });
  await chip(page, 4);
  assert.equal(await page.locator('#versions li').count(), 2);
  assert.equal(await page.locator('#vp-state').textContent(), 'Version 2');
  await page.locator('#versions li').first().getByRole('button', { name: 'Restore' }).click();
  assert.equal(await page.locator('#vp-state').textContent(), 'Version 1');
  assert.deepEqual(errors, []);
  await page.close();
});

test('a version saved in the browser downloads as a real .3dm that rhino3dm can open', async () => {
  const { page } = await open();
  await chip(page, 2); await approve(page);
  await page.fill('#say', 'Change the bedside tables to light walnut'); await page.press('#say', 'Enter'); await approve(page);
  await page.fill('#say', 'Save as Version 3'); await page.press('#say', 'Enter');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('#versions li').last().getByRole('button', { name: 'Download .3dm' }).click()]);
  assert.equal(dl.suggestedFilename(), 'Version-3.3dm');
  const file = join(mkdtempSync(join(os.tmpdir(), 'dl-')), 'v3.3dm');
  await dl.saveAs(file);
  const out = execFileSync('python3', ['-c', `
import rhino3dm, json, sys
m = rhino3dm.File3dm.Read(sys.argv[1])
s = dict(m.Strings[i] for i in range(len(m.Strings)))
spec = json.loads(s['design-spec'])
w = [o for o in m.Objects if o.Attributes.GetUserString('part') == 'wardrobe-carcass'][0].Geometry.GetBoundingBox()
print(json.dumps({'objects': len(m.Objects), 'version': s['version'], 'depth': spec['wardrobe']['depth'], 'bedside': spec['bedside']['material'], 'carcass': w.Max.X - w.Min.X, 'units': str(m.Settings.ModelUnitSystem)}))`, file]).toString();
  const r = JSON.parse(out);
  assert.equal(r.version, 'Version 3'); assert.equal(r.depth, 700); assert.equal(r.carcass, 700);
  assert.equal(r.bedside, 'walnut_light'); assert.equal(r.units, 'UnitSystem.Millimeters'); assert.ok(r.objects > 100);
  await page.close();
});

test('clicking an object shows its Rhino layer, material and user text', async () => {
  const { page } = await open();
  const b = await page.locator('#view').boundingBox();
  await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.45);
  const props = page.locator('#props');
  await props.waitFor({ state: 'visible' });
  assert.match(await props.textContent(), /Bedroom \/ Joinery \/ Wardrobe[\s\S]*element=wardrobe/);
  await page.keyboard.press('Escape');
  assert.equal(await props.isVisible(), false);
  await page.close();
});

test('compare slider, prebuilt files and the 404 page', async () => {
  const { page } = await open();
  await page.locator('#cmp').fill('20');
  assert.equal(await page.locator('#compare').evaluate(e => e.style.getPropertyValue('--cut')), '20%');
  for (const f of ['Version-1.3dm', 'Version-2.3dm', 'Variant-C.3dm']) {
    const r = await page.request.get(base + 'models/' + f);
    assert.equal(r.status(), 200);
    assert.equal((await r.body()).subarray(0, 24).toString(), '3D Geometry File Format ');
  }
  const nf = await page.request.get(base + 'nope');
  assert.equal(nf.status(), 404);
  await page.close();
});

test('phone width: no sideways scrolling and the instructions still work', async () => {
  const { page } = await open(390, 844);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await chip(page, 0);
  assert.equal(await page.locator('.proposal').count(), 1);
  await page.close();
});
