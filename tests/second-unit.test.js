// second-unit.test.js — a shooting day with a 2nd unit (Ana, 3 Nov, Il colpo): its own scenes and hours,
// kept apart from the main unit's. Scenes and names are made up (this repo is public).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChange } from '../src/proposal-rules.js';
import { shootingDays } from '../src/model.js';

const film = {
  characters: [],
  schedule: [
    { scene_id: '20', day: 5, order: 1, date: '2026-11-04', week: 2, call: '15:00', wrap: '23:00' },
    { scene_id: '21', day: 5, order: 2, date: '2026-11-04', week: 2, call: '15:00', wrap: '23:00' },
  ],
  scenes: {}, presets: {}, proposals: {},
};

const secondUnit = { op: 'set_day_scenes', day: 5, unit: '2nd', scene_ids: ['30', '30A'],
  fields: { date: '2026-11-04', call: '08:00', wrap: '16:00', week: 2, unit_name: 'Rossi' } };

test('a 2nd unit added to a day keeps the main unit scenes', () => {
  const { film: f } = applyChange(film, secondUnit);
  const main = f.schedule.filter(r => r.day === 5 && !r.unit).map(r => r.scene_id);
  const second = f.schedule.filter(r => r.day === 5 && r.unit === '2nd').map(r => r.scene_id);
  assert.deepEqual(main, ['20', '21']);
  assert.deepEqual(second, ['30', '30A']);
  assert.equal(f.schedule.find(r => r.scene_id === '30').unit_name, 'Rossi');
});

test('the day keeps the main unit call and shows the 2nd unit apart', () => {
  const { film: f } = applyChange(film, secondUnit);
  const [day] = shootingDays(f);
  assert.equal(day.call, '15:00', 'never the 2nd unit 08:00');
  assert.deepEqual(day.scenes.map(s => s.scene_id), ['20', '21']);
  assert.equal(day.second.name, 'Rossi');
  assert.equal(day.second.call, '08:00');
  assert.deepEqual(day.second.scenes.map(s => s.scene_id), ['30', '30A']);
});

test('new main unit times leave the 2nd unit times alone', () => {
  let f = applyChange(film, secondUnit).film;
  f = applyChange(f, { op: 'set_day', day: 5, fields: { call: '16:00' } }).film;
  const [day] = shootingDays(f);
  assert.equal(day.call, '16:00');
  assert.equal(day.second.call, '08:00');
});

test('new main unit scenes leave the 2nd unit scenes alone', () => {
  let f = applyChange(film, secondUnit).film;
  f = applyChange(f, { op: 'set_day_scenes', day: 5, scene_ids: ['21', '22'] }).film;
  const [day] = shootingDays(f);
  assert.deepEqual(day.scenes.map(s => s.scene_id), ['21', '22']);
  assert.deepEqual(day.second.scenes.map(s => s.scene_id), ['30', '30A']);
});

test('taking the 2nd unit off a day leaves the main unit', () => {
  let f = applyChange(film, secondUnit).film;
  f = applyChange(f, { op: 'set_day_scenes', day: 5, unit: '2nd', scene_ids: [] }).film;
  const [day] = shootingDays(f);
  assert.equal(day.second, undefined);
  assert.deepEqual(day.scenes.map(s => s.scene_id), ['20', '21']);
});

test('a scene the PDL puts on several days stays on all of them', () => {
  let f = applyChange(film, { op: 'set_day_scenes', day: 6, scene_ids: ['21', '23'], shared_ids: ['21'],
    fields: { date: '2026-11-05' } }).film;
  assert.deepEqual(f.schedule.filter(r => r.scene_id === '21').map(r => r.day).sort(), [5, 6]);
  f = applyChange(f, { op: 'set_day_scenes', day: 7, scene_ids: ['20'], fields: { date: '2026-11-06' } }).film;
  assert.deepEqual(f.schedule.filter(r => r.scene_id === '20').map(r => r.day), [7], 'not shared: it moves');
});

test('a day with no 2nd unit looks the same as before', () => {
  const [day] = shootingDays(film);
  assert.equal(day.second, undefined);
  assert.equal(day.call, '15:00');
  assert.equal(day.date, '2026-11-04');
});
