// hours.test.js — the end of the shooting day: countdown, the wrap question and its snooze,
// hours worked and overtime, the week, and hours/ files in the repo. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { today, workedOf, weekOf, mondayOf, minutesOf, span, nowRounded, countedOvertime } from '../src/hours-rules.js';
import { fileContent, setFileContent, emptyProject } from '../src/store/repo-files.js';

// LBE-like: 8h continuate, day 8 on Wed 30 Sep 10:00–18:00, day 9 on Thu 1 Oct
const film = (hours = {}, workday = '8h') => ({
  settings: { workday },
  schedule: [
    { scene_id: '12', day: 8, order: 1, date: '2026-09-30', call: '10:00', wrap: '18:00' },
    { scene_id: '15', day: 8, order: 2, date: '2026-09-30', call: '10:00', wrap: '18:00' },
    { scene_id: '14', day: 9, order: 1, date: '2026-10-01', call: '10:00', wrap: '18:00' },
  ],
  hours,
});
const at = (date, time) => new Date(`${date}T${time}:00`);

test('countdown to the ODG wrap, then the question', () => {
  assert.deepEqual(today(film(), at('2026-09-30', '13:48')), { day: 8, call: '10:00', wrap: '18:00', phase: 'before', left: 252 });
  assert.equal(span(252), '4h 12m');
  assert.equal(today(film(), at('2026-09-30', '18:05')).phase, 'ask');
  assert.equal(today(film(), at('2026-10-02', '12:00')), null, 'not a shooting day');
});

test('not yet → snoozed for an hour, then "is this a wrap?"', () => {
  const late = film({ 8: { status: 'late', snooze_until: at('2026-09-30', '19:05').toISOString() } });
  assert.deepEqual(
    (({ phase, over }) => ({ phase, over }))(today(late, at('2026-09-30', '18:35'))), { phase: 'late', over: 35 });
  assert.equal(today(late, at('2026-09-30', '19:06')).phase, 'ask-wrap');
  const done = film({ 8: { status: 'wrapped', real_wrap: '19:00' } });
  assert.equal(today(done, at('2026-09-30', '19:30')).phase, 'wrapped');
});

test('"As each ODG": overtime starts at that day\'s own wrap, whatever its length (Confine, 6 Nov)', () => {
  const project = film({ 8: { status: 'wrapped', real_wrap: '18:30' }, 9: { status: 'wrapped', real_wrap: '18:00' } }, 'odg');
  project.schedule[2] = { ...project.schedule[2], call: '08:00', wrap: '16:00' }; // day 9: 8h continuato
  assert.deepEqual(workedOf(project, 8), { worked: 510, extra: 30 }, '10:00–18:00 on the ODG, wrapped 18:30');
  assert.deepEqual(workedOf(project, 9), { worked: 600, extra: 120 }, '08:00–16:00 on the ODG, wrapped 18:00');
});

test('worked and overtime depend on the working day', () => {
  const day8 = { 8: { status: 'wrapped', real_wrap: '19:00' } };
  assert.deepEqual(workedOf(film(day8), 8), { worked: 540, extra: 60 }, '8h continuate: 9h worked = 1h extra');
  assert.deepEqual(workedOf(film(day8, '10h-lunch'), 8), { worked: 540, extra: 0 });
  assert.equal(workedOf(film(), 8), null, 'no real wrap yet');
  // past midnight
  const night = { ...film({ 8: { status: 'wrapped', real_wrap: '02:30' } }) };
  night.schedule = night.schedule.map(s => (s.day === 8 ? { ...s, call: '18:00', wrap: '02:00' } : s));
  assert.deepEqual(workedOf(night, 8), { worked: 510, extra: 30 });
});

test('the week: Monday to Sunday, with the total overtime', () => {
  const monday = mondayOf(at('2026-10-01', '09:00'));
  assert.equal(monday.getDate(), 28);
  const week = weekOf(film({ 8: { status: 'wrapped', real_wrap: '19:00' }, 9: { status: 'wrapped', real_wrap: '18:00' } }), monday);
  assert.deepEqual(week.map(d => [d.day, d.extra]), [[8, 60], [9, 0]]);
});

test('times', () => {
  assert.equal(minutesOf('18:30'), 1110);
  assert.equal(minutesOf(''), null);
  assert.equal(nowRounded(at('2026-09-30', '19:37')), '19:35');
});

test('hours/<day>.json travels with the film', () => {
  const project = emptyProject({ id: 'f', name: 'F' }, 'projects/f');
  setFileContent(project, 'hours/8.json', { day: 8, status: 'wrapped', real_wrap: '19:00' });
  assert.equal(fileContent(project, 'hours/8.json').real_wrap, '19:00');
  assert.equal(project.hours['8'].status, 'wrapped');
});

test('overtime after the first hour counts double (LBE: 1h 15m + 1h 15m = 3h)', () => {
  const lbe = { settings: { overtime: { double_after: 60 } } };
  assert.equal(countedOvertime(lbe, 75), 90);
  assert.equal(countedOvertime(lbe, 75) + countedOvertime(lbe, 75), 180);
  assert.equal(countedOvertime(lbe, 45), 45);
  assert.equal(countedOvertime({}, 75), 75, 'no rule: as worked');
});

test('a worked day whose scenes a later ODG moved away stays in the week (D17, 13 Oct)', () => {
  const p = film({ 7: { day: 7, date: '2026-09-29', status: 'wrapped', real_wrap: '18:00', call: '09:30', odg_wrap: '17:30' } });
  assert.deepEqual(workedOf(p, 7), { worked: 510, extra: 30 });
  const week = weekOf(p, mondayOf(at('2026-09-30', '12:00')));
  assert.deepEqual(week.map(d => d.day), [7, 8, 9]);
  assert.equal(week[0].real_wrap, '18:00');
});

