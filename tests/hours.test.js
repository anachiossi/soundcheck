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

test('the night before: meeting, leave window, wake, sleep (Ana\'s calculator)', async () => {
  const { wakePlan, nextShootingDay } = await import('../src/hours-rules.js');
  const project = { ...film(), settings: { commute: {} } };
  assert.deepEqual(wakePlan(project, { day: 10, date: '2026-10-02', call: '09:00' }),
    { day: 10, date: '2026-10-02', call: '09:00', meet: '08:15', leaveFrom: '06:45', leaveTo: '07:00', wake: '06:00', sleep: '22:00' });
  assert.equal(wakePlan(project, { day: 1, call: '06:00' }).sleep, '19:00');
  assert.equal(wakePlan(project, { day: 1, call: '03:00' }).wake, '00:00');
  assert.equal(wakePlan({ settings: {} }, { call: '09:00' }), null, 'no commute settings: no plan');
  assert.equal(nextShootingDay(project, at('2026-09-30', '20:00')).day, 9);
  assert.equal(nextShootingDay(project, at('2026-10-01', '00:15')).day, 9, 'after midnight: the day you wake up for');
  assert.equal(nextShootingDay(project, at('2026-10-01', '12:00')), null, 'after its call: the next one');
});

test('the alarms use the call of an ODG still waiting for review (Ana, 7 Oct)', async () => {
  const { nextShootingDay, wakePlan } = await import('../src/hours-rules.js');
  const project = {
    settings: { commute: { meet_before_call: 90, travel_min: 30, travel_max: 45, get_ready: 45, sleep_hours: 8 } },
    schedule: [{ day: 15, order: 1, scene_id: '27fin', date: '2026-10-09', call: '09:00', wrap: '17:00' }],
    proposals: {
      'odg-14': { id: 'odg-14', title: 'ODG #14', day: 14, status: 'open', decisions: {}, changes: [
        { id: 'c1', op: { op: 'set_day', day: 15, fields: { call: '10:00', wrap: '18:00' } } },
        { id: 'c2', op: { op: 'set_day_scenes', day: 15, scene_ids: [] } }] },
    },
  };
  const now = new Date('2026-10-08T20:00:00');
  const day = nextShootingDay(project, now);
  assert.equal(day.call, '10:00');
  assert.equal(day.fromOdg, 'ODG #14');
  assert.equal(day.scenes.length, 1); // the scenes still wait for Ana
  assert.equal(wakePlan(project, day).wake, '07:00');
  project.proposals['odg-14'].decisions = { c1: 'rejected' };
  assert.equal(nextShootingDay(project, now).call, '09:00'); // a rejected change doesn't count
  project.proposals['odg-14'].decisions = {};
  project.proposals['odg-15'] = { id: 'odg-15', title: 'ODG #15', day: 15, status: 'open', decisions: {}, changes: [
    { id: 'c1', op: { op: 'set_day_scenes', day: 16, scene_ids: ['29'], fields: { date: '2026-10-12', call: '08:00' } } }] };
  assert.equal(nextShootingDay(project, new Date('2026-10-10T20:00:00')).call, '08:00'); // a new day from an ODG
});

test('overtime after the first hour counts double (LBE: 1h 15m + 1h 15m = 3h)', () => {
  const lbe = { settings: { overtime: { double_after: 60 } } };
  assert.equal(countedOvertime(lbe, 75), 90);
  assert.equal(countedOvertime(lbe, 75) + countedOvertime(lbe, 75), 180);
  assert.equal(countedOvertime(lbe, 45), 45);
  assert.equal(countedOvertime({}, 75), 75, 'no rule: as worked');
});
