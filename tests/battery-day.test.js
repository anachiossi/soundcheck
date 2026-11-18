// battery-day.test.js — how many batteries a shooting day will use (battery-day.js). Made-up film. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batteryPlan, dayLength, nextDay } from '../src/battery-day.js';

const film = (count = { mini: 24, aa: 50 }) => ({
  transmitters: [{ id: '1', model: 'Mini' }, { id: '2', model: 'Mini' }, { id: '3', model: 'Mini' }, { id: 'B1', model: 'Boom' }, { id: 'B2', model: 'Boom' }, { id: '13', model: 'Small' }],
  settings: { presets: { not_for_actors: ['B1', 'B2'] } },
  presets: { 10: { rows: [{ tx_id: '1' }, { tx_id: '2' }] }, 11: { rows: [{ tx_id: '2' }, { tx_id: '' }] } },
  schedule: [{ day: 7, date: '2026-11-19', call: '08:00', wrap: '16:00', scene_id: '10', order: 1 }],
  gearBatteries: {
    devices: [{ model: 'Mini', battery: 'NP-BX1', takes: 1 }, { model: 'Boom', battery: 'AA', takes: 2 }, { model: 'Small', battery: 'AA', takes: 1 }],
    groups: [{ id: 'b1', battery: 'NP-BX1', models: { Mini: 180 } }, { id: 'b2', battery: 'AA', models: { Boom: 180 } }],
    batteries: [...Array.from({ length: count.mini }, (_, i) => ({ id: `m${i}`, group: 'b1', label: String(i + 1), state: 'full' })),
      ...Array.from({ length: count.aa }, (_, i) => ({ id: `a${i}`, group: 'b2', label: String(i + 1), state: 'full' }))],
  },
});
const day = { day: 7, date: '2026-11-19', call: '08:00', wrap: '16:00', scenes: [{ scene_id: '10' }, { scene_id: '11' }] };

test('an 8 hour day changing every 3 hours needs 3 sets for each transmitter on', () => {
  const [aa, mini] = [...batteryPlan(film(), day).lines].sort((a, b) => a.battery.localeCompare(b.battery));
  assert.deepEqual([mini.battery, mini.need, mini.have, mini.spare], ['NP-BX1', 6, 24, 18]);
  assert.deepEqual([aa.battery, aa.need, aa.have, aa.spare], ['AA', 12, 50, 38]);
});

test('the IFB transmitters count all day and each receiver takes one set', () => {
  const project = film();
  project.gearBatteries.devices.push({ model: 'IFB mix', battery: 'AA', takes: 2, always_on: true }, { model: 'IFB boom', battery: 'AA', takes: 2, always_on: true },
    { model: 'EK', battery: 'AA', takes: 2, whole_day: true });
  project.gearBatteries.groups[1].models = { Boom: 180, 'IFB mix': 240, 'IFB boom': 240 };
  project.ifbReceivers = [{ id: '1', model: 'EK' }, { id: '2', model: 'EK' }, { id: '3', model: 'EK' }];
  project.ifbList = { rows: [{ rx_id: '1' }, { rx_id: '2' }, { rx_id: '3', out: true }, { rx_id: '' }] };
  const aa = batteryPlan(project, day).lines.find(line => line.battery === 'AA');
  const need = Object.fromEntries(aa.models.map(model => [model.model, model.need]));
  assert.deepEqual(need, { Boom: 12, 'IFB mix': 4, 'IFB boom': 4, EK: 4 });
  assert.equal(aa.need, 24);
});

test('a transmitter not used that day is not counted', () => {
  const { lines } = batteryPlan(film(), day);
  assert.equal(lines.flatMap(line => line.models).some(model => model.model === 'Small'), false);
});

test('too few batteries show as a negative spare', () => {
  const mini = batteryPlan(film({ mini: 4, aa: 50 }), day).lines.find(line => line.battery === 'NP-BX1');
  assert.equal(mini.spare, -2);
});

test('a wrap after midnight still gives the length of the day', () => {
  assert.equal(dayLength({ call: '19:00', wrap: '02:00' }), 420);
  assert.equal(dayLength({ call: '', wrap: '16:00' }), null);
});

test('the plan is for the next shooting day, today included', () => {
  assert.equal(nextDay(film(), '2026-11-19').day, 7);
  assert.equal(nextDay(film(), '2026-11-20'), null);
});
