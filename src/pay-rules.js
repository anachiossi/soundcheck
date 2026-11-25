// pay-rules.js — the sums of Film → Paycheck (Ana, 25 Nov): which of your shooting days a payslip has paid.
// Your days = the film's shooting days up to today; a film whose alarms follow only the days with a 2nd unit
// (settings commute.days, Il colpo: Ana works the main unit only on those days) counts only those days.
// The payslips come from the private pay repo (pay-download.js); each lists the days it pays (pipeline/read_payslip.py).
// A day not paid while a LATER day already is, was skipped: it is marked, so it can be asked for.
// Plain data in, plain data out. Dates are 'YYYY-MM-DD' strings.
// Used by: screens/paycheck.js

import { shootingDays } from './model.js';

// '2026-11-19' → '2026-11-16', the Monday of its week (counted in UTC, so no time zone moves the day)
export function mondayOf(date) {
  const [year, month, day] = date.split('-').map(Number);
  const moment = new Date(Date.UTC(year, month - 1, day));
  moment.setUTCDate(moment.getUTCDate() - ((moment.getUTCDay() + 6) % 7));
  return moment.toISOString().slice(0, 10);
}

// your shooting days up to today: [{ date, day, second }]
export function yourDays(project, today) {
  const onlySecondUnit = project.settings?.commute?.days === 'days_with_2nd_unit';
  return shootingDays(project)
    .filter(day => day.date && day.date <= today && (!onlySecondUnit || day.second))
    .map(day => ({ date: day.date, day: day.day, second: Boolean(day.second) }));
}

// every day worked or paid, with its payslip (or none), grouped by week, the newest week first:
// [{ monday, days: [{ date, day, second, payslip, yours, skipped }] }]
export function payWeeks(project, payslips, today) {
  const paidBy = {};
  for (const payslip of payslips) for (const date of payslip.days || []) paidBy[date] = payslip;
  const lastPaid = Object.keys(paidBy).sort().pop() || '';
  const days = new Map(yourDays(project, today).map(day => [day.date, { ...day, yours: true }]));
  for (const date of Object.keys(paidBy)) {
    if (!days.has(date)) days.set(date, { date, day: null, second: false, yours: false }); // paid, not one of your days
  }
  const weeks = new Map();
  for (const day of [...days.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const payslip = paidBy[day.date] || null;
    const monday = mondayOf(day.date);
    if (!weeks.has(monday)) weeks.set(monday, { monday, days: [] });
    weeks.get(monday).days.push({ ...day, payslip, skipped: !payslip && day.date < lastPaid });
  }
  return [...weeks.values()].reverse();
}

// { worked, paid, skipped: [dates], gross, net } for the summary on top
export function payTotals(weeks, payslips) {
  const days = weeks.flatMap(week => week.days).filter(day => day.yours);
  const sum = key => Math.round(payslips.reduce((total, payslip) => total + (Number(payslip[key]) || 0), 0) * 100) / 100;
  return {
    worked: days.length,
    paid: days.filter(day => day.payslip).length,
    skipped: days.filter(day => day.skipped).map(day => day.date),
    gross: sum('gross'),
    net: sum('net'),
  };
}

// 1234.5 → '€ 1.234,50' (as the payslips print it; written by hand: phones group 4-digit numbers differently)
export function euro(amount) {
  const [whole, cents] = (Math.round(Number(amount || 0) * 100) / 100).toFixed(2).split('.');
  return `€ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents}`;
}
