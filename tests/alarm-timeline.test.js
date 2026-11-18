// alarm-timeline.test.js — the morning timeline (src/alarm-timeline-rules.js): the robot's times in the order of the
// morning, only the alarms ring, plain words under a line, and the days that get no alarm. Made-up names. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesBetween, skippedDaysText, sleepText, timelineRows } from '../src/alarm-timeline-rules.js';

const plan = {
  day: 70, date: '2026-11-24', call: '08:00', sleep: '22:30', wake: '06:00', leaveAlarm: '06:45', walkOut: '07:00',
  rideLeaves: '07:20', onSet: '07:45', rideWith: 'Marco Bianchi', rideCall: '',
  toMeeting: { minutes: 20, mode: 'walk' }, drive: { minutes: 25 },
};

test('the lines follow the morning, from bed to the call', () => {
  assert.deepEqual(timelineRows(plan).map(row => row.time), ['22:30', '06:00', '06:45', '07:00', '07:20', '07:45', '08:00']);
});

test('only the two alarms ring', () => {
  assert.deepEqual(timelineRows(plan).filter(row => row.rings).map(row => row.title), ['Alarm: wake up', 'Alarm: 15 min to go']);
});

test('the words under a line say the sleep, the walk, the drive and the ride', () => {
  const rows = timelineRows(plan, { rideGap: 40 });
  assert.equal(rows[0].note, '7½ h sleep');
  assert.equal(rows[3].note, 'walk 20 min');
  assert.equal(rows[4].title, 'Car with Marco');
  assert.equal(rows[4].note, "drive 25 min · Marco's call isn't out yet: counted 40 min before yours");
  assert.equal(rows[5].note, '15 min before the call');
});

test('a ride whose call is printed says it', () => {
  assert.equal(timelineRows({ ...plan, rideCall: '07:30' })[4].note, "drive 25 min · Marco's call 07:30");
});

test('a leave alarm at the walking-out time is one ringing line, not two', () => {
  const rows = timelineRows({ ...plan, leaveAlarm: '07:00' });
  assert.deepEqual(rows.filter(row => row.rings).map(row => row.title), ['Alarm: wake up', 'Alarm: leave home']);
});

test('with no ride and no meeting point, the drive goes under leaving home', () => {
  const rows = timelineRows({ ...plan, rideWith: '', rideLeaves: '07:00', toMeeting: null });
  assert.equal(rows.find(row => row.time === '07:00').note, 'drive 25 min');
  assert.equal(rows.some(row => row.title.startsWith('Car')), false);
});

test('minutes are counted across midnight, and sleep to the half hour', () => {
  assert.equal(minutesBetween('23:30', '00:15'), 45);
  assert.equal(sleepText({ sleep: '23:00', wake: '07:00' }), '8 h sleep');
});

const project = {
  settings: { commute: { days: 'days_with_2nd_unit' } },
  schedule: [
    { day: 66, date: '2026-11-18', scene_id: '1' }, { day: 67, date: '2026-11-19', scene_id: '2' },
    { day: 68, date: '2026-11-20', scene_id: '3' }, { day: 69, date: '2026-11-23', scene_id: '4' },
    { day: 70, date: '2026-11-24', scene_id: '5' }, { day: 70, date: '2026-11-24', scene_id: '6', unit: '2nd' },
  ],
};

test('the days with no 2nd unit before the next alarm are said in plain words', () => {
  assert.equal(skippedDaysText(project, plan, '2026-11-18'), 'D66–69: no alarm (no 2nd unit those days)');
  assert.equal(skippedDaysText(project, plan, '2026-11-23'), 'D69: no alarm (no 2nd unit that day)');
});

test('a film whose alarms follow every day says nothing about skipped days', () => {
  assert.equal(skippedDaysText({ ...project, settings: { commute: {} } }, plan, '2026-11-18'), '');
});
