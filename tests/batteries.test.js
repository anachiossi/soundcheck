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
