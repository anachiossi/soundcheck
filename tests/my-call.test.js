// my-call.test.js — crew sharing step 6: "My call" (my-call.js: the general crew call or the person's
// own call on the call sheet) and crew hours on the phone (a crew phone never downloads the film's
// hours/ and push/, drops an old copy, and exports only its own timesheet block).
// GitHub is never called: fetch is replaced by a fake. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { myCallFor, withMyCalls, daysNotOnSheet, sameName, NOT_ON_CALL_SHEET } from '../src/my-call.js';
import { today, workedOf, weekOf, mondayOf, wakePlan } from '../src/hours-rules.js';
import { ownHoursOnly } from '../src/crew-sync.js';
import { syncAsCrew, syncAsOwner } from '../src/sync.js';
import { timesheetBlob, timesheetPeople } from '../src/export/timesheet.js';

const FOLDER = 'projects/test-film';
const crewConnection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Davide', role: 'crew', name: 'Davide', folder: FOLDER };
const ownerConnection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Office laptop' };
const at = (date, time) => new Date(`${date}T${time}:00`);

// Day 8 on Wed 30 Sep 10:00–18:00, day 9 on Thu 1 Oct 10:00–18:00; the call sheet of day 8 only.
const film = (hours = {}) => ({
  settings: { workday: '8h' },
  schedule: [
    { scene_id: '12', day: 8, order: 1, date: '2026-09-30', call: '10:00', wrap: '18:00' },
    { scene_id: '14', day: 9, order: 1, date: '2026-10-01', call: '10:00', wrap: '18:00' },
  ],
  crewCalls: { '2026-09-30': { 'Inês  Rossi': '08:50', 'Maria Bianchi': '09:30' } },
  hours,
});
const personal = name => ({ mode: 'personal', name });

// ---- My call ----------------------------------------------------------------------

test('a personal call is the name\'s call on that day\'s call sheet', () => {
  assert.deepEqual(myCallFor(film(), { date: '2026-09-30', call: '10:00' }, personal('Maria Bianchi')),
    { call: '09:30', source: 'personal', note: '' });
});

test('the name matches with no capitals, accents or extra spaces', () => {
  for (const typed of ['ines rossi', 'INES ROSSI', '  Inês Rossi ', 'Ines   rossi']) {
    assert.equal(myCallFor(film(), { date: '2026-09-30', call: '10:00' }, personal(typed)).call, '08:50', typed);
  }
  assert.ok(sameName('Inês  Rossi', 'ines rossi'));
  assert.ok(!sameName('Ines Rossi', 'Ines Rosso'));
});

test('a name not on that day\'s call sheet falls back to the crew call, with the note', () => {
  assert.deepEqual(myCallFor(film(), { date: '2026-10-01', call: '10:00' }, personal('Maria Bianchi')),
    { call: '10:00', source: 'fallback', note: NOT_ON_CALL_SHEET });
  assert.equal(NOT_ON_CALL_SHEET, "Your name wasn't on this day's call sheet: using the crew call.");
  assert.equal(myCallFor(film(), { date: '2026-09-30', call: '10:00' }, personal('Someone Else')).source, 'fallback');
});

test('never set, general, or personal with no name: the general crew call', () => {
  for (const setting of [undefined, null, { mode: 'general', name: 'Maria Bianchi' }, personal('  ')]) {
    assert.deepEqual(myCallFor(film(), { date: '2026-09-30', call: '10:00' }, setting), { call: '10:00', source: 'general', note: '' });
  }
});

test('the general crew call leaves the film exactly as it is (Ana unchanged by default)', () => {
  const project = film({ 8: { status: 'wrapped', real_wrap: '19:00' } });
  assert.equal(withMyCalls(project, undefined), project);
  assert.equal(withMyCalls(project, { mode: 'general', name: '' }), project);
  assert.deepEqual(workedOf(withMyCalls(project, undefined), 8), { worked: 540, extra: 60 });
});

test('with a personal call, the hours, the wrap clock and the week count from it', () => {
  const project = film({ 8: { status: 'wrapped', real_wrap: '18:00' } });
  const mine = withMyCalls(project, personal('maria bianchi'));
  assert.deepEqual(workedOf(mine, 8), { worked: 510, extra: 30 }, '09:30 → 18:00 = 8h 30m');
  assert.equal(today(mine, at('2026-09-30', '13:00')).call, '09:30');
  const week = weekOf(mine, mondayOf(at('2026-09-30', '12:00')));
  assert.deepEqual(week.map(d => [d.day, d.call]), [[8, '09:30'], [9, '10:00']]);
  assert.deepEqual(daysNotOnSheet(project, week, personal('maria bianchi')).map(d => d.day), [9], 'day 9: the notice');
  assert.equal(project.schedule[0].call, '10:00', 'the film itself (the Schedule) keeps the crew call');
});

test('the wake plan starts from my call; riding with someone still follows their call', () => {
  const project = { ...film(), settings: { commute: { meet_before_call: 45, travel_min: 75, travel_max: 90, get_ready: 45, sleep_hours: 8 } } };
  const day = { day: 8, date: '2026-09-30', call: '10:00' };
  assert.equal(wakePlan(project, { ...day, call: myCallFor(project, day, personal('Maria Bianchi')).call }).wake, '06:30');
  assert.equal(wakePlan(project, day).wake, '07:00', 'general: as before');
  project.settings.commute.ride_with = 'ines rossi';
  assert.equal(wakePlan(project, { ...day, call: '09:30' }).rideCall, '08:50', 'ride_with matches accents too');
});

// ---- crew hours on the phone ------------------------------------------------------

function fakeGitHub(answers) {
  const asked = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = url.replace('https://api.github.com/repos/someone/film-data', '');
    asked.push({ method, path });
    const answer = answers(method, path);
    if (typeof answer === 'number') return { ok: false, status: answer };
    return { ok: true, status: 200, json: async () => answer };
  };
  return asked;
}
const asBlob = object => ({ content: Buffer.from(JSON.stringify(object)).toString('base64') });
function memoryStore(project) {
  const store = { project, read: () => store.project, save: async next => { store.project = next; } };
  return store;
}

// The film in the repo: a gear list, Ana's hours of day 8 and her phone on the wrap alerts list.
function repo(method, path) {
  if (path === '/git/ref/heads/main') return { object: { sha: 'c1' } };
  if (path === '/git/commits/c1') return { tree: { sha: 't1' } };
  if (path.startsWith('/git/trees/t1')) return { tree: [
    { type: 'blob', path: `${FOLDER}/gear/items.json`, sha: 'sha-gear' },
    { type: 'blob', path: `${FOLDER}/hours/8.json`, sha: 'sha-ana-hours' },
    { type: 'blob', path: `${FOLDER}/push/ana-iphone.json`, sha: 'sha-ana-push' }] };
  if (path === '/git/blobs/sha-gear') return asBlob([{ id: 'g1', name: 'Umbrella top', qty: 1 }]);
  if (path === '/git/blobs/sha-ana-hours') return asBlob({ day: 8, status: 'wrapped', real_wrap: '21:00' });
  if (path === '/git/blobs/sha-ana-push') return asBlob({ endpoint: 'x' });
  if (method === 'GET' && path.startsWith('/issues?')) return [];
  return 404;
}

const phoneFilm = extra => ({ id: 'test-film', name: 'Test Film', folder: FOLDER, presets: {}, schedule: [],
  hours: {}, push: {}, shas: {}, outbox: {}, conflicts: {}, ...extra });

test('a crew phone never downloads the film\'s hours/ and push/ files', async () => {
  const asked = fakeGitHub(repo);
  const store = memoryStore(phoneFilm());
  await syncAsCrew(crewConnection, store);
  const read = asked.map(call => call.path);
  assert.ok(read.includes('/git/blobs/sha-gear'), 'the film is downloaded');
  assert.ok(!read.includes('/git/blobs/sha-ana-hours') && !read.includes('/git/blobs/sha-ana-push'));
  assert.deepEqual(store.project.hours, {});
  assert.deepEqual(store.project.push, {});
  assert.deepEqual(Object.keys(store.project.shas), ['gear/items.json']);
  assert.deepEqual(asked.filter(call => call.method !== 'GET'), [], 'nothing written');
});

test('Ana\'s hours already on a crew phone are dropped at the next sync; its own hours stay', async () => {
  fakeGitHub(repo);
  const own = { day: 9, status: 'wrapped', real_wrap: '19:00' };
  const store = memoryStore(phoneFilm({
    hours: { 8: { day: 8, real_wrap: '21:00' }, 9: own }, push: { 'ana-iphone': { endpoint: 'x' } },
    shas: { 'hours/8.json': 'sha-ana-hours', 'push/ana-iphone.json': 'sha-ana-push' },
    outbox: { 'hours/9.json': { saved_at: '2026-10-01T19:00:00.000Z' } },
  }));
  await syncAsCrew(crewConnection, store);
  assert.deepEqual(store.project.hours, { 9: own });
  assert.deepEqual(store.project.push, {});
  assert.deepEqual(Object.keys(store.project.outbox), ['hours/9.json'], 'its own day stays on the phone');
  assert.deepEqual(ownHoursOnly(store.project).hours, { 9: own }, 'nothing more to drop');
});

test('Ana\'s devices still download the film\'s hours as before', async () => {
  fakeGitHub(repo);
  const store = memoryStore(phoneFilm());
  await syncAsOwner(ownerConnection, store);
  assert.equal(store.project.hours['8'].real_wrap, '21:00');
  assert.deepEqual(store.project.push['ana-iphone'], { endpoint: 'x' });
});

test('a crew timesheet holds only the person\'s own block', async () => {
  const project = { name: 'Test Film', settings: { workday: '8h' }, crew: [
    { name: 'Maria Bianchi', job: 'Fonico' }, { name: 'Davide', job: 'Microfonista' }, { name: 'Luca Verdi', job: 'Aiuto fonico' }] };
  assert.deepEqual(timesheetPeople(project, 'davide'), [{ name: 'Davide', job: 'Microfonista' }]);
  assert.deepEqual(timesheetPeople(project, 'Someone New'), [{ name: 'Someone New', job: '' }], 'not in the crew list: still their block');
  assert.equal(timesheetPeople(project).length, 3, 'Ana: the whole sound department');
  const days = [{ day: 8, date: '2026-09-30', call: '10:00', wrap: '18:00', real_wrap: '19:00' }];
  const sheet = await timesheetBlob(project, days, 'week', 'Davide').text();
  assert.ok(sheet.includes('Davide') && sheet.includes('Microfonista'));
  assert.ok(!sheet.includes('Maria Bianchi') && !sheet.includes('Luca Verdi'));
  const everyone = await timesheetBlob(project, days, 'week').text();
  assert.ok(everyone.includes('Maria Bianchi') && everyone.includes('Luca Verdi'));
});
