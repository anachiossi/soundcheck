// logic.test.js — checks the data logic with a small made-up film.
// Run: npm test   (or: node --test tests/)
// No real film data here: this repo is public.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../tools/csv.js';
import { convertSheets, scheduleFromCsv } from '../tools/sheets.js';
import { textColourFor, isNearWhite } from '../src/colour.js';
import {
  naturalCompare, toSpeaker, shootingDays, weeks, defaultDay, dayIsDone, sceneRows,
  unscheduledScenes, formatDate, allSceneIds, sceneInfo, timeClass,
} from '../src/model.js';

const raw = {
  characters: 'char_id,char_name,char_actor,char_color\n1,ANNA,Maria Rossi,#4561ff\n2,BRUNO,,#fae039\n',
  transmitters: 'tx_id,tx_model,tx_color,tx_connector,tx_pref_order\n1,ZMT4,#e9e9e9,lemo,1\n2,ZMT4,#e9e9e9,lemo,2\nB1,HM,#e9e9e9,XLR,3\n',
  lavaliers: 'lav_id,lav_model,lav_color,lav_attenuated,lav_connector,lav_brand\n7,6060,#000000,0,lemo,DPA\n8,4060,#000000,1,microdot,DPA\n',
  schedule: 'scene_id,shoot_day,shoot_order,shoot_id,shoot_date_iso,shoot_week,call_time,wrap_time\n' +
    '10A,1,2,12,2026-09-21,1,10:00,18:00\n2,1,1,11,2026-09-21,1,10:00,18:00\n5,2,1,21,2026-09-28,2,16:30,00:30\n',
  presets: { rows: [
    { scene_id: 2, character_id: 1, tx_id: 1, lav_id: 7, speaker: true, updated_at_iso: '2026-09-26T10:00:00Z' },
    { scene_id: 2, character_id: 2, tx_id: 2, lav_id: 8, speaker: false, updated_at_iso: '2026-09-26T11:00:00Z' },
    { scene_id: '10A', character_id: 2, tx_id: 1, lav_id: 7, speaker: '' },
    { scene_id: '99', character_id: 1, tx_id: 1, lav_id: 7, speaker: 1 },
  ] },
};
const project = { id: 'test', name: 'Test film', ...convertSheets(raw),
  scenes: { 2: { int_ext: 'INT', time_of_day: 'Notte', set: 'CASA - CUCINA', synopsis: 'Anna cooks.' } } };

test('CSV: quotes, commas and line breaks inside a cell', () => {
  const rows = parseCsv('﻿a,b\r\n"x, y","line1\nline2"\r\n');
  assert.deepEqual(rows, [{ a: 'x, y', b: 'line1\nline2' }]);
});

test('scene numbers sort the way a human expects', () => {
  assert.deepEqual(['10A', '2', '10', '1A', '1'].sort(naturalCompare), ['1', '1A', '2', '10', '10A']);
});

test('speaker values from the sheets become yes / no / maybe', () => {
  assert.equal(toSpeaker(true), 'yes');
  assert.equal(toSpeaker('0'), 'no');
  assert.equal(toSpeaker(''), 'maybe');
});

test('presets are grouped per scene, newest time kept', () => {
  assert.equal(project.presets['2'].rows.length, 2);
  assert.equal(project.presets['2'].updated_at, '2026-09-26T11:00:00Z');
});

test('days come in order with scenes in shooting order', () => {
  const days = shootingDays(project);
  assert.deepEqual(days.map(d => d.day), [1, 2]);
  assert.deepEqual(days[0].scenes.map(s => s.scene_id), ['2', '10A']);
  assert.equal(weeks(project).length, 2);
});

test('the app opens on today, or the next shooting day', () => {
  assert.equal(defaultDay(project, '2026-09-21'), 1);
  assert.equal(defaultDay(project, '2026-09-22'), 2);
  assert.equal(defaultDay(project, '2027-01-01'), 2);
});

test('scene rows carry character, TX, lav and a connector warning', () => {
  const [anna, bruno] = sceneRows(project, '2');
  assert.equal(anna.character.name, 'ANNA');
  assert.equal(anna.connectorMismatch, false);
  assert.equal(bruno.lav.attenuated, true);
  assert.equal(bruno.connectorMismatch, true);
});

test('scenes with a preset but no shooting day are listed as unscheduled', () => {
  assert.deepEqual(unscheduledScenes(project), ['99']);
  assert.deepEqual(allSceneIds(project), ['2', '5', '10A', '99']);
});

test('dates never shift with the time zone', () => {
  assert.equal(formatDate('2026-09-28', { weekday: true }), 'Mon 28 Sep');
  assert.equal(scheduleFromCsv(raw.schedule)[2].wrap, '00:30');
});

test('text colour is readable on light and dark backgrounds', () => {
  assert.equal(textColourFor('#fae039'), '#0f172a');
  assert.equal(textColourFor('#1e3a8a'), '#ffffff');
  assert.equal(isNearWhite('#e9e9e9'), true);
});

test('scene info (INT/EXT, set, synopsis) is found, and missing info is fine', () => {
  assert.equal(sceneInfo(project, '2').set, 'CASA - CUCINA');
  assert.equal(sceneInfo(project, '5'), null);
  assert.equal(sceneInfo({ ...project, scenes: undefined }, '2'), null);
});

test('time of day in Italian or English gets the right colour group', () => {
  assert.equal(timeClass('Notte'), 'night');
  assert.equal(timeClass('Tramonto'), 'dusk');
  assert.equal(timeClass('Mattina'), 'morning');
  assert.equal(timeClass('Giorno'), 'day');
  assert.equal(timeClass('NIGHT'), 'night');
});

// ---- ✉ email robot badge ----
import { robotHealth, ago } from '../src/email-robot.js';

test('email robot: checked recently = ok, 30+ min = late, failed run = failed', () => {
  const now = Date.parse('2026-09-28T20:00:00Z');
  const run = { status: 'completed', conclusion: 'success', at: '2026-09-28T19:00:00Z' };
  assert.equal(robotHealth({ checkedAt: '2026-09-28T19:52:00Z', run }, now), 'ok');
  assert.equal(robotHealth({ checkedAt: '2026-09-28T19:20:00Z', run }, now), 'late');
  assert.equal(robotHealth({ checkedAt: '2026-09-28T19:55:00Z', run: { ...run, conclusion: 'failure' } }, now), 'failed');
  assert.equal(robotHealth({ noAccess: true }, now), 'unknown');
  assert.equal(ago('2026-09-28T19:52:00Z', now), '8 min ago');
  assert.equal(ago('2026-09-28T17:00:00Z', now), '3 h ago');
});

test('a day is over after its wrap time; Schedule then opens on the next day', () => {
  const day = { day: 7, date: '2026-09-29', call: '09:00', wrap: '17:00' };
  const at = (date, h, m = 0) => { const [y, mo, d] = date.split('-').map(Number); return new Date(y, mo - 1, d, h, m); };
  assert.equal(dayIsDone(day, at('2026-09-29', 16, 59)), false);
  assert.equal(dayIsDone(day, at('2026-09-29', 17, 0)), true);
  assert.equal(dayIsDone(day, at('2026-09-30', 8)), true);
  const night = { day: 8, date: '2026-09-30', call: '18:00', wrap: '02:00' };
  assert.equal(dayIsDone(night, at('2026-10-01', 1)), false, 'a night shoot is not over at 1 am');
  assert.equal(dayIsDone(night, at('2026-10-01', 2)), true);
  const film = { schedule: [
    { scene_id: '11', day: 7, order: 1, date: '2026-09-29', call: '09:00', wrap: '17:00' },
    { scene_id: '12', day: 8, order: 1, date: '2026-09-30', call: '09:00', wrap: '17:00' }] };
  assert.equal(defaultDay(film, at('2026-09-29', 10)), 7);
  assert.equal(defaultDay(film, at('2026-09-29', 18)), 8);
});

test('scenes already shot: every day they are on is over (Scenes tab, dark grey)', async () => {
  const { doneScenes } = await import('../src/model.js');
  const project = { schedule: [
    { scene_id: '1', day: 1, order: 1, date: '2026-10-05', call: '09:00', wrap: '18:00' },
    { scene_id: '2', day: 2, order: 1, date: '2026-10-07', call: '09:00', wrap: '18:00' },
    { scene_id: '3', day: 3, order: 1, date: '2026-10-09', call: '09:00', wrap: '18:00' }] };
  assert.deepEqual([...doneScenes(project, new Date('2026-10-07T19:44:00'))], ['1', '2']);
  assert.deepEqual([...doneScenes(project, new Date('2026-10-07T12:00:00'))], ['1']);
});
