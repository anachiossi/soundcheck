// robot-alarms.test.js — the alarms robot (pipeline/gmail-trigger.gs) run with a FAKE Google: fixed Maps answers,
// a fake film repo, dates read as UTC. Checks the two legs (home → meeting point → the day's place) that the
// automatic alarms and the app's alarm page share (Ana, 6 Nov). Made-up places only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../pipeline/gmail-trigger.gs', import.meta.url), 'utf8');

// Maps answers: driving 50 min · walking 2.5 km in 30 min · public transport 18 min on board, leaving 25 min before
// the arrival asked for (a wait included)
function fakeMaps(asked) {
  return {
    DirectionFinder: { Mode: { DRIVING: 'driving', WALKING: 'walking', TRANSIT: 'transit' } },
    newDirectionFinder() {
      const q = {};
      const finder = {
        setOrigin: v => { q.from = v; return finder; }, setDestination: v => { q.to = v; return finder; },
        setMode: v => { q.mode = v; return finder; }, setDepart: v => { q.depart = v; return finder; },
        setArrive: v => { q.arrive = v; return finder; },
        getDirections() {
          asked.push({ ...q });
          if (q.mode === 'driving') return { routes: [{ legs: [{ duration: { value: 50 * 60 } }] }] };
          if (q.mode === 'walking') return { routes: [{ legs: [{ duration: { value: 30 * 60 }, distance: { value: 2500 } }] }] };
          const departure = q.arrive ? q.arrive.getTime() / 1000 - 25 * 60 : 0;
          return { routes: [{ legs: [{ duration: { value: 18 * 60 }, distance: { value: 9000 }, departure_time: { value: departure } }] }] };
        },
      };
      return finder;
    },
  };
}

function robot({ files, properties = {}, now = '2026-11-08T20:00:00Z' }) {
  const asked = [];
  const cache = {};
  const pushes = [];
  const pad = n => String(n).padStart(2, '0');
  const context = {
    console: { log() {}, warn() {} },
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new Date(now).getTime(); } },
    Utilities: {
      parseDate: text => new Date(`${text.replace(' ', 'T')}:00Z`),
      formatDate: (d, zone, format) => (format === 'HH:mm' ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
        : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] || null,
      setProperty: (name, value) => { properties[name] = value; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    UrlFetchApp: {
      fetch(url, options) {
        if (url.includes('/dispatches')) {
          pushes.push(JSON.parse(options.payload).inputs);
          return { getResponseCode: () => 204, getContentText: () => '' };
        }
        const path = decodeURI(url.split('/contents/')[1] || '');
        const found = path === 'projects' ? Object.keys(files).map(f => f.split('/')[1]).filter((v, i, a) => a.indexOf(v) === i)
          .map(name => ({ type: 'dir', name })) : files[path];
        return { getResponseCode: () => (found === undefined ? 404 : 200), getContentText: () => JSON.stringify(found), getHeaders: () => ({}) };
      },
    },
    Maps: fakeMaps(asked),
  };
  vm.createContext(context);
  vm.runInContext(`${CODE}\nthis.exported = { commuteLegs, planAnswer, alarmAnswer, upcomingPlans, checkNextDayPush, doGet, COMMUTE };`, context);
  return { ...context.exported, asked, pushes };
}

const PLACES = { places: [
  { kind: 'set', label: 'SET', text: 'Casa Rossi, Via Uno 1', link: '' },
  { kind: 'mezzi', label: 'MEZZI TECNICI', text: 'Via Tre 3', link: '' }] };
const confine = (commute = {}) => ({
  'projects/test-film/settings.json': { commute: { ride_from: 'Public Station', walk_to_ride: 20, travel: 'maps', drive_to: 'mezzi',
    meet_before_call: 30, get_ready: 45, sleep_hours: 8, leave_alarm_before: 15, to_meeting: 'auto', drive_margin: 10, ...commute } },
  'projects/test-film/film.json': { name: 'Test film' },
  'projects/test-film/schedule.json': [{ scene_id: '1', day: 28, order: 1, date: '2026-11-09', call: '10:00', wrap: '20:00' }],
  'projects/test-film/locations.json': { '2026-11-09': { ...PLACES.places[1], ...PLACES } },
  'projects/test-film/proposals': [],
});

test('the drive goes to the place the film chose, with Google\'s time plus the margin', () => {
  const { commuteLegs, COMMUTE } = robot({ files: confine(), properties: { HOME_FROM: 'home' } });
  const c = { ...COMMUTE, ...confine()['projects/test-film/settings.json'].commute };
  const { drive } = commuteLegs(c, confine()['projects/test-film/locations.json']['2026-11-09'], '2026-11-09', 9 * 60 + 30);
  assert.equal(drive.place.label, 'MEZZI TECNICI');
  assert.equal(drive.google, 50);
  assert.equal(drive.minutes, 60, '50 from Google + 10 margin');
});

test('home → meeting point: on foot under 1 km, else public transport arriving when the ride leaves', () => {
  const { commuteLegs, COMMUTE, asked } = robot({ files: confine(), properties: { HOME_FROM: 'home' } });
  const c = { ...COMMUTE, ...confine()['projects/test-film/settings.json'].commute };
  const { toMeeting } = commuteLegs(c, PLACES, '2026-11-09', 9 * 60 + 30);
  assert.deepEqual({ ...toMeeting }, { minutes: 25, mode: 'transit', maps: true }, '2.5 km: public transport, 25 min with the wait');
  const transit = asked.find(q => q.mode === 'transit');
  assert.equal(transit.arrive.toISOString(), '2026-11-09T08:30:00.000Z', 'arriving when the truck leaves: 09:30 − 60');
  assert.equal(transit.to, 'Public Station');
});

test('the automatic alarm: wake, the film\'s name, leave — from the same two legs', () => {
  const { alarmAnswer } = robot({ files: confine(), properties: { HOME_FROM: 'home' } });
  // call 10:00 → on set 09:30 → truck leaves 08:30 → leave home 08:05 → wake 07:20 · leave alarm 07:50
  assert.equal(alarmAnswer(new Date('2026-11-08T20:00:00Z')), '07:20;Test film · D28 · 09/11/2026;07:50');
});

test('no home address in the robot: the film\'s fixed minutes to the meeting point, as before', () => {
  const { alarmAnswer } = robot({ files: confine() });
  // 08:30 − 20 = 08:10 → wake 07:25 · leave alarm 07:55
  assert.equal(alarmAnswer(new Date('2026-11-08T20:00:00Z')), '07:25;Test film · D28 · 09/11/2026;07:55');
});

const NOW = new Date('2026-11-08T20:00:00Z');

test('the app gets the whole plan, and its answer is exactly what the shortcut gets', () => {
  const { planAnswer, alarmAnswer } = robot({ files: confine(), properties: { HOME_FROM: 'home' } });
  const plan = planAnswer({ plan: 'test-film' }, NOW);
  assert.deepEqual([plan.onSet, plan.rideLeaves, plan.walkOut, plan.leaveAlarm, plan.wake, plan.sleep],
    ['09:30', '08:30', '08:05', '07:50', '07:20', '23:20']);
  assert.equal(plan.answer, alarmAnswer(NOW));
  assert.equal(plan.answer, '07:20;Test film · D28 · 09/11/2026;07:50');
  assert.equal(plan.wakeAt, '2026-11-09T07:20:00.000Z');
  assert.equal(plan.call, '10:00');
});

test('the alarm page sees its unsaved numbers counted, and they are never saved by asking', () => {
  const files = confine();
  const { planAnswer } = robot({ files, properties: { HOME_FROM: 'home' } });
  const plan = planAnswer({ plan: 'test-film', drive_to: 'set', drive_margin: '0', get_ready: '60' }, NOW);
  assert.equal(plan.drive.place.label, 'SET');
  assert.equal(plan.drive.minutes, 50);
  assert.equal(plan.toMeeting.minutes, 25);
  assert.equal(plan.wake, '07:15', 'on set 09:30 − 50 − 25 = 08:15, − 60 getting ready');
  assert.ok(!JSON.stringify(plan).includes('home'), 'never an address of home');
  assert.equal(files['projects/test-film/settings.json'].commute.get_ready, 45);
});

test('the link can never ask the time from home to a place of its choice', () => {
  const { planAnswer, asked } = robot({ files: confine(), properties: { HOME_FROM: 'home' } });
  planAnswer({ plan: 'test-film', ride_from: 'Some Other Place', to_meeting: 'walk' }, NOW);
  assert.ok(asked.length > 0);
  assert.ok(asked.every(question => question.to !== 'Some Other Place' && question.from !== 'Some Other Place'));
});

test('a plan further than three days ahead still reaches the app, but the shortcut answers none', () => {
  const { planAnswer, alarmAnswer } = robot({ files: confine() });
  const early = new Date('2026-11-03T20:00:00Z');
  assert.equal(planAnswer({ plan: 'test-film' }, early).day, 28);
  assert.equal(alarmAnswer(early), 'none');
});

test('with no shooting day ahead the app is told so', () => {
  const { planAnswer } = robot({ files: confine() });
  assert.equal(planAnswer({ plan: 'test-film' }, new Date('2026-11-10T20:00:00Z')).none, true);
});

test('fixed times: the film\'s own minutes, Google is not asked', () => {
  const { planAnswer, asked } = robot({ files: confine({ travel: 'fixed', travel_max: 40, to_meeting: '', drive_margin: 0 }), properties: { HOME_FROM: 'home' } });
  const plan = planAnswer({ plan: 'test-film' }, NOW);
  assert.deepEqual([plan.rideLeaves, plan.walkOut, plan.wake], ['08:50', '08:30', '07:45']);
  assert.equal(asked.length, 0);
});

test('alarms switched off for a film: no plan, and the shortcut answers none', () => {
  const { planAnswer, alarmAnswer } = robot({ files: confine({ off: true }) });
  assert.equal(planAnswer({ plan: 'test-film' }, NOW).none, true);
  assert.equal(alarmAnswer(NOW), 'none');
});

test('the shortcut is told error, never none, when something fails: a good alarm is not erased', () => {
  const { doGet } = robot({ files: { get 'projects/test-film/settings.json'() { throw new Error('GitHub down'); } }, properties: { ALARM_KEY: 'k' } });
  assert.equal(doGet({ parameter: { key: 'k' } }).text, 'error');
  assert.equal(doGet({ parameter: { key: 'wrong' } }).text, 'wrong key');
});

test('on a film of 2nd-unit days, a main-unit-only day sets no alarm (Ana, 5 Nov)', () => {
  const files = confine({ days: 'days_with_2nd_unit' });
  assert.equal(robot({ files }).alarmAnswer(NOW), 'none');
  files['projects/test-film/schedule.json'].push({ scene_id: '2', day: 28, order: 2, date: '2026-11-09', call: '06:00', wrap: '14:00', unit: '2nd' });
  assert.equal(robot({ files }).alarmAnswer(NOW), '07:25;Test film · D28 · 09/11/2026;07:55', 'the main unit\'s call, not the 2nd unit\'s');
});

test('the alarms use the call of an ODG still waiting for review (Ana, 7 Oct)', () => {
  const files = { ...confine(), 'projects/test-film/proposals': [{ name: 'odg-27.json' }],
    'projects/test-film/proposals/odg-27.json': { status: 'open', day: 27, decisions: {}, changes: [{ id: 'c1', op: { op: 'set_day', day: 28, fields: { call: '11:00' } } }] } };
  assert.equal(robot({ files }).alarmAnswer(NOW), '08:25;Test film · D28 · 09/11/2026;08:55');
  files['projects/test-film/proposals/odg-27.json'].decisions = { c1: 'rejected' };
  assert.equal(robot({ files }).alarmAnswer(NOW), '07:25;Test film · D28 · 09/11/2026;07:55', 'a rejected change does not count');
});

test('riding with someone: the plan follows their call, and my own call stays on screen', () => {
  const files = { ...confine({ ride_with: 'Maria Rossi', my_name: 'Ines Rossi' }),
    'projects/test-film/calls.json': { '2026-11-09': { 'Maria  Rossi': '09:00', 'Inês Rossi': '09:30' } } };
  const plan = robot({ files }).planAnswer({ plan: 'test-film' }, NOW);
  assert.deepEqual([plan.call, plan.rideWith, plan.rideCall, plan.onSet], ['09:30', 'Maria Rossi', '09:00', '08:30']);
});

test('riding with someone whose call is not known yet counts the gap before my own call', () => {
  const files = { ...confine({ ride_with: 'Nobody Known' }), 'projects/test-film/calls.json': {} };
  const plan = robot({ files }).planAnswer({ plan: 'test-film' }, NOW);
  assert.deepEqual([plan.rideCall, plan.onSet], ['', '08:50'], '10:00 − 40 − 30');
});

test('the next day notification goes once, and again only when the times change', () => {
  const files = { ...confine(), 'projects/test-film/push': [{ name: 'phone.json' }] };
  const properties = {};
  const first = robot({ files, properties });
  first.checkNextDayPush();
  first.checkNextDayPush();
  assert.equal(first.pushes.length, 1);
  assert.equal(first.pushes[0].title, 'Next: D28 · call 10:00');
  assert.equal(first.pushes[0].body, '⏰ wake 07:25 · 🚪 leave 08:10 · 💤 sleep 23:25');
  assert.equal(first.pushes[0].url, './#hours');
  files['projects/test-film/schedule.json'] = [{ scene_id: '1', day: 28, order: 1, date: '2026-11-09', call: '11:00', wrap: '20:00' }];
  const moved = robot({ files, properties });
  moved.checkNextDayPush();
  assert.equal(moved.pushes.length, 1, 'a new call: a new notification');
});
