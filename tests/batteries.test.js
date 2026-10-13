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
