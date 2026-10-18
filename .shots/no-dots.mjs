// The mic table with no "…" (Ana, 18 Oct): scenes 25 and 49 of day 21 with today's data, phone / iPad / laptop.
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const P = 'D:/sound_check_data/projects/la-buona-educazione/';
const json = f => JSON.parse(readFileSync(P + f, 'utf8'));
const presets = Object.fromEntries(readdirSync(P + 'presets').map(f => [f.replace('.json', ''), json('presets/' + f)]));
const data = { gearItems: json('gear/items.json'), characters: json('characters.json'), lavaliers: json('lavaliers.json'),
  scenes: json('scenes.json'), settings: json('settings.json'), presets };
const sizes = { phone: [390, 844], ipad: [820, 1180], laptop: [1280, 800] };
const b = await chromium.launch({ channel: 'msedge' });
for (const [name, [width, height]] of Object.entries(sizes)) {
  const page = await (await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto('http://localhost:8321/');
  await page.setInputFiles('input[type=file]', '.shots/lbe-now.soundcheck.json');
  await page.waitForSelector('.scene');
  await page.evaluate(async d => {
    const { getState, setState } = await import('./src/state.js');
    const p = getState().project;
    setState({ message: null, lookup: ['25', '49'], project: { ...p, ...d } });
  }, data);
  await page.click('.tabs button:has-text("Scenes")');
  await page.waitForSelector('#scene-49');
  for (const id of ['25', '49']) {
    await page.evaluate(i => document.querySelector(`#scene-${i} .mics`)?.scrollIntoView({ block: 'start' }), id);
    await page.screenshot({ path: `.shots/nodots-${name}-${id}.png` });
    const pages = await page.$$(`#scene-${id} .mics__dots button`);
    for (let n = 1; n < pages.length; n++) {
      await pages[n].click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `.shots/nodots-${name}-${id}-p${n + 1}.png` });
    }
    const cut = await page.evaluate(i => [...document.querySelectorAll(`#scene-${i} .mics .pill b`)]
      .filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent), id);
    console.log(name, id, 'pages', Math.max(1, pages.length), 'cut words:', cut.length ? cut.join(', ') : 'none');
  }
}
await b.close();
