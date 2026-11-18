// alarm-card.test.js — the app shows the alarm robot's answer and does no sums of its own (Ana, 18 Nov): the button hands
// over the robot's words, the last answer is kept for no signal, the alarm page saves one place for the rules.
// The robot is never called: fetch and localStorage are fakes. Made-up names only. Run: npm test

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { alarmsLink, canSetAlarms } from '../src/parts/robot-plan.js';
import { askPlan, keptPlan, setRobotLink } from '../src/robot-link.js';
import { cleanCommute, modeOf, pageChoices, savedCommute } from '../src/parts/alarm-fields.js';

const LINK = 'https://script.google.com/macros/s/abc/exec?key=k';
const project = { folder: 'projects/test-film' };
const plan = { day: 59, wake: '06:00', leaveAlarm: '06:45', wakeAt: '2026-11-09T05:00:00.000Z', answer: '06:00;Il colpo · D59 · 09/11/2026;06:45' };

beforeEach(() => {
  const stored = {};
  globalThis.localStorage = { getItem: key => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; }, removeItem: key => { delete stored[key]; } };
  setRobotLink(LINK);
});

test('the button hands the shortcut the robot\'s answer, word for word', () => {
  assert.equal(decodeURIComponent(alarmsLink(plan).split('&text=')[1]), plan.answer);
});

test('the alarms can be set only in the 24 hours before the wake-up', () => {
  assert.equal(canSetAlarms(plan, new Date('2026-11-08T20:00:00Z')), true);
  assert.equal(canSetAlarms(plan, new Date('2026-11-07T20:00:00Z')), false, 'too far: an iPhone alarm would ring tomorrow');
  assert.equal(canSetAlarms(plan, new Date('2026-11-09T06:00:00Z')), false, 'the wake-up has passed');
  assert.equal(canSetAlarms({ none: true }), false);
});

test('the robot\'s answer is kept, and with no signal the last one is still there', async () => {
  globalThis.fetch = async () => ({ text: async () => JSON.stringify(plan) });
  await askPlan(project);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await askPlan(project)).error, 'no signal');
  assert.equal(keptPlan(project).answer, plan.answer);
  assert.ok(keptPlan(project).asked_at, 'it says when it was asked');
});

test('a preview of numbers not saved yet never replaces the answer kept', async () => {
  globalThis.fetch = async () => ({ text: async () => JSON.stringify(plan) });
  await askPlan(project);
  globalThis.fetch = async () => ({ text: async () => JSON.stringify({ ...plan, answer: 'preview' }) });
  assert.equal((await askPlan(project, { get_ready: 60 })).answer, 'preview');
  assert.equal(keptPlan(project).answer, plan.answer);
});

test('a robot not updated yet is reported, and nothing is kept from it', async () => {
  globalThis.fetch = async () => ({ text: async () => '06:00;Il colpo · D59 · 09/11/2026;06:45' });
  assert.equal((await askPlan(project)).error, 'old robot');
  assert.equal(keptPlan(project), null);
});

test('the switch reads the film\'s way of working', () => {
  assert.equal(modeOf({ off: true, travel: 'maps' }), 'off');
  assert.equal(modeOf({ travel: 'maps' }), 'place');
  assert.equal(modeOf({}), 'fixed');
});

test('saving the alarm page keeps the film\'s other settings and takes out a choice emptied on the page', () => {
  const current = { my_name: 'Someone', days: 'days_with_2nd_unit', to_meeting: 'auto', walk_to_ride: 20, meet_before_call: 30, travel: 'maps' };
  const page = cleanCommute({ ...current, to_meeting: '', walk_to_ride: '25', drive_to: 'mezzi', drive_margin: '10' });
  const saved = savedCommute(current, page);
  assert.equal(saved.my_name, 'Someone');
  assert.equal(saved.days, 'days_with_2nd_unit');
  assert.equal(saved.to_meeting, undefined, '"Fixed minutes": no Google for the way to the meeting point');
  assert.deepEqual([saved.walk_to_ride, saved.drive_margin, saved.drive_to, saved.travel], [25, 10, 'mezzi', 'maps']);
});

test('the robot is asked with every choice of the page, an emptied one too', () => {
  const choices = pageChoices(cleanCommute({ travel: 'maps', get_ready: '50', ride_with: '' }));
  assert.equal(choices.off, 'no');
  assert.equal(choices.ride_with, '', 'nobody: it must win over the saved ride');
  assert.equal(choices.get_ready, 50);
  assert.equal('sleep_hours' in choices, false, 'an empty number: the film\'s own value stays');
});

test('the meeting point is never sent in the question to the robot', () => {
  assert.equal('ride_from' in pageChoices(cleanCommute({ travel: 'maps', ride_from: 'Some Station' })), false);
});
