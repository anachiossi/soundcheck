// sync.mjs — end-to-end check of editing + syncing with the REAL GitHub repo,
// on a scratch branch (never main). Two browser "devices", A and B:
//   1. both connect, A downloads the film
//   2. A edits a scene OFFLINE → it waits; reload keeps it; back online → uploaded
//   3. B downloads the film and sees A's change
//   4. both change the same scene → A is asked; "Keep mine" wins in the repo
//   5. week and all-film images are made
//
//   npm run serve   (other terminal)
//   GH_TOKEN=... SC_BRANCH=sync-test node tests/sync.mjs
// Screenshots → .shots/ (never committed).

import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const URL = process.env.SC_URL || 'http://localhost:8321/';
const TOKEN = process.env.GH_TOKEN;
const BRANCH = process.env.SC_BRANCH || 'sync-test';
if (!TOKEN || BRANCH === 'main') throw new Error('Needs GH_TOKEN and a scratch branch (not main).');

const api = async path => {
  const r = await fetch(`https://api.github.com/repos/anachiossi/soundcheck-data/contents/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } });
  return JSON.parse(Buffer.from((await r.json()).content, 'base64').toString('utf8'));
};
const check = (ok, text) => { console.log(`${ok ? '✔' : '✖'} ${text}`); if (!ok) process.exitCode = 1; };

const browser = await chromium.launch({ channel: 'msedge' });
async function device(name, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', e => check(false, `${name} page error: ${e.message}`));
  page.on('console', m => m.text().startsWith('SYNC') && console.log(`   [${name}] ${m.text()}`));
  await page.goto(URL);
  await page.fill('input[type=password]', TOKEN);
  await page.fill('input[placeholder^="e.g."]', `test ${name}`);
  await page.click('details summary');
  await page.fill('.form details input >> nth=1', BRANCH);
  await page.click('.form .btn--primary');
  await page.click('text=La buona educazione');
  await page.waitForSelector('.scene', { timeout: 60000 });
  return { context, page };
}

// Edit scene `sceneId`: first row gets TX `txId`.
async function editScene(page, sceneId, txId) {
  await page.click('.tabs button:nth-child(2)');
  await page.fill('.search input', sceneId);
  await page.press('.search input', 'Enter');
  await page.click(`#scene-${sceneId} button[title=Edit]`);
  await page.click(`#scene-${sceneId} .mics__row--edit >> nth=0 >> .edit-cell >> nth=1`);
  await page.fill('.sheet input', txId);
  await page.click(`.sheet .option:has(.pill--tx b:text-is("${txId}"))`);
  await page.click(`#scene-${sceneId} .edit-actions .btn--primary, #scene-${sceneId} .edit-actions .btn--danger`);
  const again = await page.$(`#scene-${sceneId} .edit-actions .btn--danger`);
  if (again) await again.click();
}

const A = await device('A');
check(true, 'A connected and downloaded the film');
await A.page.screenshot({ path: '.shots/sync-A-day.png' });

// 2. offline edit
await A.context.setOffline(true);
await editScene(A.page, '2', '20');
check(await A.page.waitForSelector('#scene-2 .scene__waiting', { timeout: 5000 }).then(() => true, () => false), 'offline save waits on the device');
await A.page.screenshot({ path: '.shots/sync-A-waiting.png', fullPage: true });
await A.page.reload();
await A.page.click('.tabs button:nth-child(2)');
check(await A.page.isVisible('#scene-2 .scene__waiting'), 'still waiting after closing and reopening, offline');
await A.context.setOffline(false);
await A.page.evaluate(async () => (await import('./src/sync.js')).syncNow());
await A.page.waitForSelector('#scene-2 .scene__waiting', { state: 'detached', timeout: 30000 });
const scene2 = await api('projects/la-buona-educazione/presets/2.json');
check(scene2.rows[0].tx_id === '20' && scene2.updated_by === 'test A', 'back online: uploaded to the repo by "test A"');

// 3. second device sees it
const B = await device('B', 820);
await B.page.click('.tabs button:nth-child(2)');
await B.page.fill('.search input', '2'); await B.page.press('.search input', 'Enter');
check((await B.page.textContent('#scene-2 .mics__row >> nth=0')).includes('20'), 'device B sees A\'s change');

// 4. conflict
await A.context.setOffline(true);
await editScene(A.page, '11', '19');
await editScene(B.page, '11', '18');
await B.page.evaluate(async () => (await import('./src/sync.js')).syncNow());
await B.page.waitForSelector('#scene-11 .scene__waiting', { state: 'detached', timeout: 30000 });
await A.context.setOffline(false);
await A.page.evaluate(async () => (await import('./src/sync.js')).syncNow());
await A.page.waitForSelector('#scene-11 .conflict', { timeout: 30000 });
await A.page.screenshot({ path: '.shots/sync-A-conflict.png', fullPage: true });
check(true, 'same scene changed on both: A is asked which to keep');
await A.page.click('#scene-11 >> text=Keep mine');
for (let i = 0; i < 30; i++) { // check once a second, up to 30 s
  const done = await A.page.evaluate(async () => {
    const s = (await import('./src/state.js')).getState();
    return !s.sync.running && !s.project.outbox['11'];
  });
  if (done) break;
  await A.page.waitForTimeout(1000);
}
console.log('   sync state after Keep mine:', JSON.stringify(await A.page.evaluate(async () => {
  const s = (await import('./src/state.js')).getState();
  return { sync: s.sync, outbox: Object.keys(s.project.outbox), conflicts: Object.keys(s.project.conflicts) };
})));
check((await api('projects/la-buona-educazione/presets/11.json')).rows[0].tx_id === '19', '"Keep mine": A\'s version is in the repo');

// 5. images
const sizes = await A.page.evaluate(async () => {
  const { scheduleImages } = await import('./src/export/schedule-images.js');
  const { getState } = await import('./src/state.js');
  const { weeks, shootingDays } = await import('./src/model.js');
  const p = getState().project;
  const week = await scheduleImages(p, weeks(p)[1].days.map(d => d.day), 'Week 2 · mic list');
  const all = await scheduleImages(p, shootingDays(p).map(d => d.day), 'All film');
  return { week: week.map(c => [c.width, c.height, c.toDataURL()]), all: all.map(c => [c.width, c.height, c.toDataURL()]) };
});
for (const [kind, parts] of Object.entries(sizes)) {
  for (const [i, [w, h, url]] of parts.entries()) await writeFile(`.shots/export-${kind}-${i + 1}.png`, Buffer.from(url.split(',')[1], 'base64'));
  check(parts.every(([, h]) => h <= 15000), `${kind}: ${parts.length} image(s), ${parts.map(([w, h]) => `${w}×${h}`).join(', ')}`);
}

// Picker screenshot on the phone
await A.page.click(`#scene-2 button[title=Edit]`);
await A.page.click(`#scene-2 .mics__row--edit >> nth=0 >> .edit-cell >> nth=1`);
await A.page.screenshot({ path: '.shots/sync-A-picker.png' });

await browser.close();
