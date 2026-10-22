// batteries.test.js — Gear → Batteries (battery-rules.js): groups, countdowns and the green / yellow / red
// of every battery (Ana, 12 Oct). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batteryGroups, timeLeft, toneOf, clock, countsOf } from '../src/battery-rules.js';
import { fileContent, setFileContent } from '../src/store/repo-files.js';

const at = '2026-10-13T08:00:00Z';
const minutesAfter = m => Date.parse(at) + m * 60000;
const aa = { id: 'b1', name: 'AA', life_min: 240, charge_min: 120 };
const film = { gearBatteries: { groups: [aa], batteries: [
  { id: 'b1-10', group: 'b1', label: '10', state: 'full', since: at },
  { id: 'b1-2', group: 'b1', label: '2', state: 'in_use', since: at, used_in: 'TX 7' },
  { id: 'b1-1', group: 'b1', label: '1', state: 'charging', since: at },
  { id: 'b1-3', group: 'b1', label: '3', state: 'empty', since: at },
] } };

test('a group lists its batteries in number order', () => {
  assert.deepEqual(batteryGroups(film)[0].batteries.map(b => b.label), ['1', '2', '3', '10']);
  assert.deepEqual(batteryGroups({}), []);
});

test('charged are green, used are red, charging yellow', () => {
  const [one, two, three, ten] = batteryGroups(film)[0].batteries;
  assert.equal(toneOf(ten, aa, minutesAfter(5)), 'green');
  assert.equal(toneOf(three, aa, minutesAfter(5)), 'red');
  assert.equal(toneOf(one, aa, minutesAfter(5)), 'yellow');
  assert.equal(toneOf(one, aa, minutesAfter(121)), 'green', 'its charging time is up: probably full');
  assert.equal(toneOf(two, aa, minutesAfter(60)), 'green');
  assert.equal(toneOf(two, aa, minutesAfter(180)), 'yellow', 'under 30% of its life');
  assert.equal(toneOf(two, aa, minutesAfter(230)), 'red', 'under 10%');
});

test('countdowns: minutes left in use and on the charger', () => {
  const [one, two] = batteryGroups(film)[0].batteries;
  assert.equal(timeLeft(two, aa, minutesAfter(100)).left, 140);
  assert.equal(timeLeft(one, aa, minutesAfter(30)).left, 90);
  assert.equal(timeLeft({ ...one, charge_min: 45 }, aa, minutesAfter(30)).left, 15, 'its own charger time wins');
  assert.equal(timeLeft(two, aa, minutesAfter(999)).left, 0);
  assert.equal(timeLeft(two, { ...aa, life_min: undefined }, minutesAfter(5)), null);
  assert.equal(clock(125), '2:05');
  assert.deepEqual(countsOf(film.gearBatteries.batteries), { full: 1, charging: 1, in_use: 1, empty: 1 });
});

test('gear/batteries.json is a film file', () => {
  const copy = {};
  setFileContent(copy, 'gear/batteries.json', film.gearBatteries);
  assert.equal(fileContent(copy, 'gear/batteries.json'), film.gearBatteries);
});

// ---- estimates: TX model × rank × learning × long scene (Ana, 12 Oct) ----
import { lifeOf, pagesOf, batteryIn, wearerOf, withRun, chargeOf, chargerLoad } from '../src/battery-rules.js';

const day = '2026-10-13';
const noon = new Date(`${day}T12:00`).getTime();
const filmDay = {
  transmitters: [{ id: '7', model: 'ZMT4.5' }, { id: 'B1', model: 'HM_ZMT4' }],
  characters: [{ id: '1', name: 'Gianni', actor: 'Luis Miguel' }],
  schedule: [{ day: 21, date: day, scene_id: '12', order: 1 }, { day: 21, date: day, scene_id: '13', order: 2 }],
  scenes: { 12: { pages: '1 2/8' }, 13: { pages: '3 1/8' } },
  presets: { 12: { rows: [{ char_id: '1', tx_id: '7' }] }, 13: { rows: [{ char_id: '1', tx_id: 'B1' }] } },
  gearBatteries: { groups: [{ id: 'b1', name: 'AA', life_min: 240, models: { 'ZMT4.5': 360 } }],
    chargers: [{ id: 'c1', name: 'Zaxcom', group: 'b1', slots: 4, charge_min: 150 }],
    batteries: [{ id: 'b1-1', group: 'b1', label: '1', state: 'in_use', used_in: 'TX 7', since: new Date(noon).toISOString() },
      { id: 'b1-2', group: 'b1', label: '2', state: 'charging', charger: 'c1', since: new Date(noon).toISOString() }] },
};
const aaGroup = filmDay.gearBatteries.groups[0];
const [inTx, onCharger] = filmDay.gearBatteries.batteries;

test('pages: 2 7/8, 4, 5/8', () => {
  assert.equal(pagesOf('2 7/8'), 2.875);
  assert.equal(pagesOf('4'), 4);
  assert.equal(pagesOf('5/8'), 0.625);
  assert.equal(pagesOf(''), 0);
});

test('the TX model\'s minutes × the battery\'s rank', () => {
  assert.equal(lifeOf(filmDay, inTx, aaGroup, noon).minutes, 360);
  assert.equal(lifeOf(filmDay, { ...inTx, life_pct: 80 }, aaGroup, noon).minutes, 288, 'an old battery');
  assert.equal(lifeOf(filmDay, { ...inTx, used_in: 'Hollyland' }, aaGroup, noon).minutes, 240, 'not a TX: the group\'s');
});

test('a long scene today (≥ 3 pages) with the TX in it: −15%', () => {
  assert.equal(lifeOf(filmDay, { ...inTx, used_in: 'B1' }, aaGroup, noon).minutes, 204);
  assert.equal(lifeOf(filmDay, { ...inTx, used_in: 'B1' }, aaGroup, noon + 86400000).minutes, 240, 'not tomorrow');
});

test('it learns from runs that ended dead or low, always aiming short', () => {
  const ran = withRun(inTx, 'dead', filmDay, noon + 300 * 60000);
  assert.deepEqual(ran.runs.map(r => [r.min, r.end, r.model]), [[300, 'dead', 'ZMT4.5']]);
  assert.equal(lifeOf(filmDay, ran, aaGroup, noon).minutes, 270, 'dead at 5:00 → 4:30');
  const ok = withRun(inTx, 'ok', filmDay, noon + 100 * 60000);
  assert.equal(lifeOf(filmDay, ok, aaGroup, noon).minutes, 360, 'still OK teaches nothing');
  const full = { ...inTx, state: 'full' };
  assert.equal(withRun(full, 'dead', filmDay, noon), full, 'only a battery leaving a TX has a run');
});

test('which battery is in a TX, who wears it today, chargers', () => {
  assert.equal(batteryIn(filmDay, '7').battery.label, '1');
  assert.equal(batteryIn(filmDay, 'B1'), null);
  assert.equal(wearerOf(filmDay, '7', noon).actor, 'Luis Miguel');
  assert.equal(chargeOf(filmDay, onCharger, aaGroup), 150);
  assert.equal(chargerLoad(filmDay, 'c1'), 1);
});

test('a place that is not a TX has its own minutes (the video kit)', () => {
  const video = { id: 'b9', name: 'Video batteries', models: { 'Mars 4K TX': 240 } };
  const battery = { id: 'b9-1', group: 'b9', label: '1', state: 'in_use', used_in: 'Mars 4K TX', since: new Date(noon).toISOString() };
  assert.equal(lifeOf(filmDay, battery, video, noon).minutes, 240);
  assert.equal(withRun(battery, 'low', filmDay, noon + 200 * 60000).runs[0].model, 'Mars 4K TX');
});

test('minutes from the power a model draws: Wh per battery × batteries ÷ W (Ana, 13 Oct)', () => {
  const project = { ...filmDay, ifbReceivers: [{ id: '3', model: 'EK1039' }],
    gearBatteries: { ...filmDay.gearBatteries, devices: [{ model: 'Mars 4K TX', watts: 8.5 }, { model: 'EK1039', watts: 0.9, takes: 2 }] } };
  const video = { id: 'b9', name: 'Video batteries', wh: 50 };
  const aa = { id: 'b8', name: 'AA', wh: 2.4 };
  const inMars = { id: 'b9-1', group: 'b9', label: '1', state: 'in_use', used_in: 'Mars 4K TX', since: new Date(noon).toISOString() };
  assert.equal(lifeOf(project, inMars, video, noon).minutes, 353, '50 Wh ÷ 8.5 W = 5:53');
  assert.equal(lifeOf(project, { ...inMars, used_in: 'RX 3' }, aa, noon).minutes, 320, '2 × 2.4 Wh ÷ 0.9 W');
  assert.equal(lifeOf(project, inMars, { ...video, models: { 'Mars 4K TX': 300 } }, noon).minutes, 300, 'the group\'s own minutes win');
});

// ---- v149: the mic table's battery column (Ana, 13 Oct: "toggle ON… a countdown starts") ----
import { txTimer, groupsForTx, placeOfTx, timeOfDay, TIMER_STALE_H } from '../src/battery-rules.js';

const rig = {
  transmitters: [{ id: '7', model: 'ZMT4.5' }, { id: 'B1', model: 'HM_ZMT4' }],
  gearBatteries: {
    groups: [{ id: 'n', name: 'new', battery: 'NP-50', wh: 3.33 }, { id: 'f', name: 'Fuji', battery: 'NP-50', wh: 3.4, models: { 'ZMT4.5': 120 } }],
    devices: [{ model: 'ZMT4.5', watts: 0.525, battery: 'NP-50' }],
    batteries: [{ id: 'f-15', group: 'f', label: '15', state: 'in_use', used_in: 'TX 7', since: at }],
    tx_on: { B1: at },
  },
};

test('battery column: a numbered battery in the TX counts down from its own minutes; the change time is since + life', () => {
  const timer = txTimer(rig, '7', minutesAfter(30));
  assert.equal(timer.battery.label, '15');
  assert.equal(timer.minutes, 120);
  assert.equal(timer.left, 90);
  assert.equal(timer.endsAt, minutesAfter(120));
});

test('battery column: ON with no number uses the best group of its battery type; unknown draw = ON, no countdown', () => {
  assert.deepEqual(groupsForTx(rig, '7').map(g => g.id), ['n', 'f']);
  const plug = txTimer(rig, 'B1', minutesAfter(10));
  assert.equal(plug.battery, null);
  assert.equal(plug.left, null, 'HM_ZMT4 has no watts: no estimate');
  assert.equal(txTimer(rig, '3', minutesAfter(10)), null, 'never switched on: OFF');
});

test('battery column: a forgotten timer (older than a day of work) shows OFF again', () => {
  assert.ok(txTimer(rig, '7', minutesAfter(60)));
  assert.equal(txTimer(rig, '7', minutesAfter(TIMER_STALE_H * 60 + 1)), null);
});

// ---- v183 (Ana, 22 Oct): a TX in sleep mode pauses its countdown ----
import { wake, sleep } from '../src/battery-sleep.js';

test('a TX asleep keeps the time left it had when it fell asleep, and shows no change time', () => {
  const asleep = { ...rig, gearBatteries: sleep(rig.gearBatteries, '7', new Date(minutesAfter(30)).toISOString()) };
  const timer = txTimer(asleep, '7', minutesAfter(90));
  assert.equal(timer.left, 90, 'still 90 minutes left, as at minute 30');
  assert.equal(timer.endsAt, null, 'paused: no change time');
  assert.ok(timer.asleep);
});

test('a TX woken goes on from where it paused: the time asleep moves its start later', () => {
  const asleep = sleep(rig.gearBatteries, '7', new Date(minutesAfter(30)).toISOString());
  const woken = wake(asleep, '7', b => b.id === 'f-15', minutesAfter(90));
  const project = { ...rig, gearBatteries: woken };
  const timer = txTimer(project, '7', minutesAfter(100));
  assert.equal(timer.left, 80, '30 awake + 10 awake = 40 of 120 gone');
  assert.equal(timer.endsAt, minutesAfter(180), 'changes an hour later than before the sleep');
  assert.equal(timer.asleep, null);
});

test('a TX with no numbered battery sleeps and wakes the same way', () => {
  const asleep = sleep(rig.gearBatteries, 'B1', new Date(minutesAfter(10)).toISOString());
  const woken = wake(asleep, 'B1', () => false, minutesAfter(40));
  assert.equal(woken.tx_on.B1, new Date(minutesAfter(30)).toISOString(), 'ON 30 minutes later than it was');
  assert.deepEqual(woken.tx_sleep, {});
  assert.equal(wake(rig.gearBatteries, '7', () => true, minutesAfter(40)), rig.gearBatteries, 'awake already: nothing changes');
});

test('battery column: place names and clock time', () => {
  assert.equal(placeOfTx('7'), 'TX 7');
  assert.equal(placeOfTx('B1'), 'B1');
  assert.match(timeOfDay(Date.parse(at)), /^\d{1,2}:\d{2}$/);
});

// ---- v171 (Ana, 19 Oct): a battery out of a TX charges by itself, and is ready again after its charge time ----
import { isReady, freeChargerFor, chargersFor, CHARGE_DEFAULT_MIN } from '../src/battery-rules.js';

test('a battery taken out of a TX is ready again once its charge time is up (3 h when nothing says)', () => {
  const group = { id: 'n', name: 'NP-50' };
  const charging = { id: 'n-1', group: 'n', label: '1', state: 'charging', since: at };
  const project = { gearBatteries: { groups: [group] } };
  assert.equal(CHARGE_DEFAULT_MIN, 180);
  assert.equal(isReady(project, charging, group, minutesAfter(179)), false, 'still charging');
  assert.equal(isReady(project, charging, group, minutesAfter(180)), true, 'charged: offered again');
  assert.equal(isReady(project, charging, { ...group, charge_min: 90 }, minutesAfter(90)), true, 'the group\'s own charge time wins');
  assert.equal(isReady(project, { ...charging, state: 'full' }, group, minutesAfter(0)), true);
  assert.equal(isReady(project, { ...charging, state: 'empty' }, group, minutesAfter(999)), false, 'empty waits for a tap in Gear');
});

test('a battery out of a TX goes on the first charger of its group with a free slot (the preferred one first)', () => {
  const project = { gearBatteries: {
    chargers: [{ id: 'c1', group: 'n', slots: 2 }, { id: 'c2', group: 'n', slots: 4 }, { id: 'c3', group: 'aa' }],
    batteries: [{ id: 'n-1', group: 'n', state: 'charging', charger: 'c1' }],
  } };
  assert.equal(freeChargerFor(project, 'n').id, 'c1', 'one slot left on the preferred charger');
  const full = { gearBatteries: { ...project.gearBatteries, batteries: [...project.gearBatteries.batteries, { id: 'n-2', group: 'n', state: 'charging', charger: 'c1' }] } };
  assert.equal(freeChargerFor(full, 'n').id, 'c2', 'the preferred one is full: the next one');
  assert.equal(freeChargerFor(project, 'aa').id, 'c3', 'no slot count: never full');
  assert.equal(freeChargerFor(project, 'np-f'), null, 'no charger for the group');
});

test('a charger made for a battery type charges every group of that type; a battery no charger takes is not rechargeable', () => {
  const project = { gearBatteries: {
    groups: [{ id: 'new', battery: 'NP-50' }, { id: 'fuji', battery: 'NP-50' }, { id: 'alk', battery: 'AA' }, { id: 'nimh', battery: 'AA' }],
    chargers: [{ id: 'wrinex', battery: 'NP-50', slots: 8 }, { id: 'isdt', group: 'nimh', slots: 8 }],
    batteries: [],
  } };
  assert.equal(freeChargerFor(project, 'fuji').id, 'wrinex');
  assert.equal(freeChargerFor(project, 'nimh').id, 'isdt');
  assert.deepEqual(chargersFor(project, 'alk'), [], 'alkaline AA: no charger, goes to Empty');
});

import { momentAt } from '../src/battery-rules.js';

test('"turned on at 10:30": that time today; a time later than now is yesterday (a night shoot)', () => {
  const now = new Date(2026, 9, 22, 12, 30).getTime();
  assert.equal(momentAt('10:30', now), new Date(2026, 9, 22, 10, 30).getTime());
  const nightNow = new Date(2026, 9, 23, 0, 30).getTime();
  assert.equal(momentAt('23:15', nightNow), new Date(2026, 9, 22, 23, 15).getTime());
});

test('battery column: a TX turned on at 10:30 counts down from 10:30, not from the tap', () => {
  const tapAt = new Date(2026, 9, 22, 12, 30).getTime();
  const onAt = new Date(momentAt('10:30', tapAt)).toISOString();
  const project = { transmitters: [{ id: '7', model: 'M' }], gearBatteries: { groups: [{ id: 'g', battery: 'AA', life_min: 300 }],
    devices: [{ model: 'M', battery: 'AA' }], batteries: [], tx_on: { 7: onAt } } };
  const timer = txTimer(project, '7', tapAt);
  assert.equal(timer.since, onAt);
  assert.equal(timer.left, 180, '5 h of life, 2 h already gone');
});


test('a sleep added afterwards (13:00–14:00) gives the countdown that hour back', () => {
  const day = (h, m = 0) => new Date(2026, 9, 22, h, m).getTime();
  const project = { transmitters: [{ id: '7', model: 'M' }], gearBatteries: { groups: [{ id: 'g', battery: 'AA', life_min: 300 }],
    devices: [{ model: 'M', battery: 'AA' }], batteries: [], tx_on: { 7: new Date(day(10)).toISOString() } } };
  assert.equal(txTimer(project, '7', day(15)).left, 0, 'on at 10:00, 5 h: flat at 15:00');
  const file = wake(sleep(project.gearBatteries, '7', new Date(day(13)).toISOString()), '7', () => false, day(14));
  const after = { ...project, gearBatteries: file };
  assert.equal(txTimer(after, '7', day(15)).left, 60, 'an hour asleep: one hour left at 15:00');
  assert.deepEqual(file.tx_sleep, {}, 'awake again');
});
