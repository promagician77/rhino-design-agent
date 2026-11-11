// Screenshots for visual review and the PDF: runs the brief's five instructions in the live page.
// Usage: node tools/shots.cjs [dir]
const { chromium } = require('playwright');
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const { serve } = await import('./serve.mjs');
  const s = await serve(process.argv[2] || 'site-dist', 0);
  const b = await chromium.launch({ args: GL });
  const errors = [];
  require('fs').mkdirSync('shots', { recursive: true });
  for (const [name, vw, vh] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: name === 'desktop' ? 1.5 : 2 });
    p.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await p.goto(`http://localhost:${s.port}/`, { waitUntil: 'load' });
    await p.hover('#view'); await p.waitForSelector('.canvas-wrap.live', { timeout: 60000 });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `shots/${name}-top.png` });
    const chip = i => p.locator('.chip').nth(i).click();
    await chip(0); await p.waitForSelector('.proposal');
    await p.waitForTimeout(600);
    await p.locator('.work').screenshot({ path: `shots/${name}-proposal1.png` });
    await p.locator('.proposal button.primary').last().click();
    await chip(1); await p.locator('.proposal button.primary').last().click();
    await chip(2); await p.waitForTimeout(300);
    await p.locator('.work').screenshot({ path: `shots/${name}-proposal3.png` });
    if (name === 'desktop') {
      const tag = await p.addStyleTag({ content: '.chips,.engine,.versions,.chat-h{display:none!important}.log{max-height:none!important}.msg:not(:last-child){display:none}' });
      await p.locator('.work').screenshot({ path: 'shots/pdf-hero.png' });
      await tag.evaluate(t => t.remove());
    }
    await p.locator('.proposal button.primary').last().click();
    await chip(5); await p.waitForSelector('.proposal.blocked');
    await p.locator('.msg.agent').last().screenshot({ path: `shots/${name}-blocked.png` });
    await chip(3); await p.waitForFunction(() => [...document.querySelectorAll('.vars img')].length >= 3 && [...document.querySelectorAll('.vars img')].every(i => i.src), null, { timeout: 60000 });
    await p.locator('.msg.agent').last().screenshot({ path: `shots/${name}-variants.png` });
    await chip(4); await p.waitForTimeout(800);
    await p.locator('.hero').screenshot({ path: `shots/${name}-after.png` });
    const box = await p.locator('#view').boundingBox();
    await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.45);
    await p.waitForTimeout(300);
    await p.locator('.viewport').screenshot({ path: `shots/${name}-props.png` });
    for (const id of ['phase1', 'phase2', 'phase3', 'phase4']) await p.locator(`#${id}`).screenshot({ path: `shots/${name}-${id}.png` });
    await p.locator('.notes').screenshot({ path: `shots/${name}-notes.png` });
    await p.close();
  }
  await b.close(); await s.close();
  console.log(errors.length ? errors.join('\n') : 'no console errors');
})();
