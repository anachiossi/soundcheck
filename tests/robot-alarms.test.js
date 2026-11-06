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
  const pad = n => String(n).padStart(2, '0');
  const context = {
    console: { log() {}, warn() {} },
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new Date(now).getTime(); } },
    Utilities: {
      parseDate: text => new Date(`${text.replace(' ', 'T')}:00Z`),
      formatDate: (d, zone, format) => (format === 'HH:mm' ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
        : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => properties[name] || null }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    UrlFetchApp: {
      fetch(url) {
        const path = decodeURI(url.split('/contents/')[1] || '');
        const found = path === 'projects' ? Object.keys(files).map(f => f.split('/')[1]).filter((v, i, a) => a.indexOf(v) === i)
          .map(name => ({ type: 'dir', name })) : files[path];
        return { getResponseCode: () => (found === undefined ? 404 : 200), getContentText: () => JSON.stringify(found), getHeaders: () => ({}) };
      },
    },
    Maps: fakeMaps(asked),
  };
  vm.createContext(context);
  vm.runInContext(`${CODE}\nthis.exported = { commuteLegs, legsAnswer, alarmAnswer, upcomingPlans, COMMUTE };`, context);
  return { ...context.exported, asked };
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

test('the alarm page asks with its unsaved choices and gets the same sums, never an address of home', () => {
  const { legsAnswer } = robot({ files: confine(), properties: { HOME_FROM: 'home' } });
  const answer = legsAnswer({ legs: 'test-film', date: '2026-11-09', meet: '09:30', drive_to: 'set', drive_margin: '0' });
  assert.equal(answer.drive.place.label, 'SET');
  assert.equal(answer.drive.minutes, 50);
  assert.equal(answer.toMeeting.minutes, 25);
  assert.ok(!JSON.stringify(answer).includes('home'));
  assert.equal(legsAnswer({ legs: 'test-film', date: 'tomorrow', meet: '09:30' }).error, 'no plan');
});
