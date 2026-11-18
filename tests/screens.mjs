// screens.mjs — opens the real app in a browser (Microsoft Edge) and takes
// screenshots of every screen at phone, iPad and laptop size, then checks the
// app still opens with the network OFF. Also saves the exported images.
//
//   npm run serve            (in one terminal)
//   node tests/screens.mjs <path to a .soundcheck.json>
//
// Screenshots go to .shots/ (never committed: they show real film data).

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

const projectFile = process.argv[2];
const URL = process.env.SC_URL || 'http://localhost:8321/';
const SIZES = { phone: [390, 844], ipad: [820, 1180], laptop: [1280, 860] };
await mkdir('.shots', { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const problems = [];

for (const [name, [width, height]] of Object.entries(SIZES)) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', e => problems.push(`${name}: ${e.message}`));
  page.on('console', m => m.type() === 'error' && problems.push(`${name}: ${m.text()}`));

  await page.goto(URL);
  await page.setInputFiles('input[type=file]', projectFile);
  await page.waitForSelector('.scene');
  const shot = async label => page.screenshot({ path: `.shots/${name}-${label}.png`, fullPage: label !== 'day' });

  const open = async (main, tab) => {
    await page.click(`.department button:has-text("${main}")`);
    await page.click(`.tabs button:has-text("${tab}")`);
  };
  await shot('day');
  await open('Today', 'Calendar'); await shot('calendar');
  await open('Today', 'Overview'); await shot('overview');
  await open('Film', 'Scenes');
  await page.fill('.search input', '15'); await page.press('.search input', 'Enter');
  await page.fill('.search input', '7A'); await page.press('.search input', 'Enter');
  await shot('scenes');
  await open('Mics', 'Cues'); await shot('cues');
  await open('Mics', 'Transmitters'); await shot('transmitters');
  await page.click('.topbar__film--button'); await shot('films');
  await page.click('.topbar__settings'); await shot('app-settings');
  await open('Film', 'Lav Rules'); await shot('lav-rules');
  await open('Film', 'Settings'); await shot('film-settings');
  await open('Today', 'Alarms'); await shot('alarms');

  if (name === 'laptop') {
    // Exported images, drawn in the page exactly as the 📷 buttons do.
    const images = await page.evaluate(async () => {
      const { sceneSheet } = await import('./src/export/image.js');
      const { getState } = await import('./src/state.js');
      const { shootingDays } = await import('./src/model.js');
      const project = getState().project;
      const day = shootingDays(project)[6];
      const ids = day.scenes.map(s => String(s.scene_id));
      return {
        scene: (await sceneSheet(project, [ids[0]], `Scene ${ids[0]}`)).toDataURL(),
        day: (await sceneSheet(project, ids, `Day ${day.day} · mic list`)).toDataURL(),
      };
    });
    for (const [label, dataUrl] of Object.entries(images)) {
      await writeFile(`.shots/export-${label}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    }

    // Offline: wait for the service worker, cut the network, reload.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await open('Today', 'Day');
    await page.waitForSelector('.scene', { timeout: 5000 }).catch(() => problems.push('offline: app did not open'));
    await shot('offline');
  }
  await context.close();
}

await browser.close();
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'OK: all screens drawn, offline works');
process.exit(problems.length ? 1 : 0);
