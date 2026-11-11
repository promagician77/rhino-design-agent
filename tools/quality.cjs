// Accessibility (axe-core, WCAG 2.x A/AA), horizontal overflow, small tap targets and console errors,
// at 390, 820 and 1440 px: on load, with a proposal pending, after the brief's instructions, with properties open, and on the 404 page.
// Writes data/axe.json.
const { chromium } = require('playwright');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const AXE = readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const WIDTHS = [390, 820, 1440];

async function scan(page, label, issues, stats) {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const small = [...document.querySelectorAll('a,button,input,select,textarea,summary')].filter(el => {
      const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!b.width || cs.visibility === 'hidden' || (el.closest('p,li,td,dd') && el.tagName === 'A')) return false; // inline text links are exempt (WCAG 2.5.8)
      if (el.type === 'checkbox' || el.type === 'radio') { const l = el.closest('label'); if (l) { const lb = l.getBoundingClientRect(); return lb.height < 24; } }
      return b.width < 24 || b.height < 24;
    }).map(el => el.outerHTML.slice(0, 90));
    return { violations: r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target?.join(' ') })), overflow, small };
  });
  stats.runs++;
  for (const v of res.violations) issues.push({ where: label, kind: 'axe', ...v });
  if (res.overflow > 1) issues.push({ where: label, kind: 'overflow', px: res.overflow });
  for (const s of res.small) issues.push({ where: label, kind: 'target<24px', el: s });
}

(async () => {
  const { serve } = await import(path.join(ROOT, 'tools/serve.mjs'));
  const s = await serve(path.join(ROOT, 'site-dist'), 0);
  const base = `http://localhost:${s.port}`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const issues = [], stats = { runs: 0 }, consoleErrors = [];
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) consoleErrors.push(`${w}: ${m.text()}`); });
    page.on('pageerror', e => consoleErrors.push(`${w}: ${e.message}`));
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.hover('#view'); await page.waitForSelector('.canvas-wrap.live', { timeout: 60000 });
    await scan(page, `/ on load @${w}`, issues, stats);
    const chip = i => page.locator('.chip').nth(i).click();
    await chip(0);
    await scan(page, `/ proposal pending @${w}`, issues, stats);
    await page.locator('.proposal button.primary').last().click();
    for (const i of [1, 2]) { await chip(i); await page.locator('.proposal button.primary').last().click(); }
    await chip(5);
    await page.locator('.calls summary').last().click();
    await scan(page, `/ blocked change, tool calls open @${w}`, issues, stats);
    await chip(3);
    await page.waitForFunction(() => [...document.querySelectorAll('.vars img')].filter(i => i.src).length >= 3, null, { timeout: 60000 });
    await chip(4);
    const b = await page.locator('#view').boundingBox();
    await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.45);
    await scan(page, `/ variants, Version 2 saved, properties open @${w}`, issues, stats);
    await page.goto(base + '/missing-page', { waitUntil: 'load' });
    await scan(page, `/404 @${w}`, issues, stats);
    await page.close();
  }
  const lum = hex => { const c = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  const pairs = [['secondary ink on paper', '4c5560', 'fcfcfa'], ['secondary ink on sheet', '4c5560', 'f3f4f1'], ['dimension blue on paper', '2a5db0', 'fcfcfa'], ['warning on paper', '9a5b00', 'fcfcfa'], ['blocked red on paper', 'a3261d', 'fcfcfa'], ['passed green on paper', '2f6b4f', 'fcfcfa'], ['walnut on paper', '6e4a2f', 'fcfcfa'], ['secondary ink on sheet panel', '4c5560', 'f3f4f1']];
  const contrast = pairs.map(([n, f, b]) => ({ pair: n, ratio: ratio(f, b) }));
  const out = { runs: stats.runs, issues, consoleErrors, contrast, minContrast: Math.min(...contrast.map(c => c.ratio)), widths: WIDTHS };
  mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  writeFileSync(path.join(ROOT, 'data/axe.json'), JSON.stringify(out, null, 2));
  console.log(`${stats.runs} scans, ${issues.length} issues, ${consoleErrors.length} console errors, min token contrast ${out.minContrast}`);
  for (const i of issues.slice(0, 40)) console.log(JSON.stringify(i));
  for (const e of consoleErrors.slice(0, 10)) console.log('CONSOLE', e);
  await browser.close(); await s.close();
})().catch(e => { console.error(e); process.exit(1); });
