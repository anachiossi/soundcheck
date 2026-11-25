// pay-rules.test.js — Film → Paycheck (src/pay-rules.js): your days, the payslip that paid each one, the weeks and
// the day a payslip skipped. Made-up film and amounts. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { euro, mondayOf, payTotals, payWeeks, yourDays } from '../src/pay-rules.js';

const project = {
  settings: { commute: { days: 'days_with_2nd_unit' } },
  schedule: [
    { day: 1, date: '2026-03-02', scene_id: '1' }, { day: 1, date: '2026-03-02', scene_id: '2', unit: '2nd' },
    { day: 2, date: '2026-03-03', scene_id: '3' },
    { day: 3, date: '2026-03-04', scene_id: '4' }, { day: 3, date: '2026-03-04', scene_id: '5', unit: '2nd' },
    { day: 4, date: '2026-03-09', scene_id: '6' }, { day: 4, date: '2026-03-09', scene_id: '7', unit: '2nd' },
    { day: 5, date: '2026-03-20', scene_id: '8' }, { day: 5, date: '2026-03-20', scene_id: '9', unit: '2nd' },
  ],
};
const payslips = [
  { file: 'payslips/a.pdf', paid_on: '2026-03-08', days: ['2026-03-02'], gross: 100, net: 90 },
  { file: 'payslips/b.pdf', paid_on: '2026-03-15', days: ['2026-03-09'], gross: 100, net: 90.5 },
];

test('your days are the shooting days up to today, only those with a 2nd unit when the film says so', () => {
  assert.deepEqual(yourDays(project, '2026-03-10').map(day => day.date), ['2026-03-02', '2026-03-04', '2026-03-09']);
  assert.equal(yourDays({ ...project, settings: {} }, '2026-03-10').length, 4, 'every shooting day on a film without the rule');
});

test('each day shows the payslip that paid it, week by week, the newest week first', () => {
  const weeks = payWeeks(project, payslips, '2026-03-10');
  assert.deepEqual(weeks.map(week => week.monday), ['2026-03-09', '2026-03-02']);
  assert.equal(weeks[1].days[0].payslip.file, 'payslips/a.pdf');
});

test('a day not paid while a later day is paid is skipped; the newest days just wait', () => {
  const weeks = payWeeks(project, payslips, '2026-03-21');
  const days = Object.fromEntries(weeks.flatMap(week => week.days).map(day => [day.date, day]));
  assert.equal(days['2026-03-04'].skipped, true);
  assert.equal(days['2026-03-20'].skipped, false, 'paid later, as usual');
  assert.deepEqual(payTotals(weeks, payslips), { worked: 4, paid: 2, skipped: ['2026-03-04'], gross: 200, net: 180.5 });
});

test('a day paid that is not one of your days still shows, marked', () => {
  const extra = [...payslips, { file: 'payslips/c.pdf', paid_on: '2026-03-15', days: ['2026-03-03'], gross: 100, net: 90 }];
  const day = payWeeks(project, extra, '2026-03-10').flatMap(week => week.days).find(one => one.date === '2026-03-03');
  assert.equal(day.yours, false);
  assert.equal(day.payslip.file, 'payslips/c.pdf');
});

test('weeks start on Monday, also across a month', () => {
  assert.equal(mondayOf('2026-03-01'), '2026-02-23');
  assert.equal(mondayOf('2026-03-02'), '2026-03-02');
});

test('money is written as the payslips write it', () => {
  assert.equal(euro(1234.5), '€ 1.234,50');
});
