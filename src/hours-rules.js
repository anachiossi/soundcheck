// hours-rules.js — the working day and its wrap time (no screen code):
//   • the film's kind of working day (settings.json → "workday"): how many hours from call to wrap
//     before overtime starts — "10h (9 + lunch)", "10h continuate", "9h continuate", "8h continuate"
//   • every shooting day has a call and a wrap from the ODG (schedule.json); the REAL wrap is
//     kept per day in hours/<day>.json: { day, date, status, real_wrap, snooze_until, … }
//       status 'wrapped' = finished (real_wrap says when) · 'late' = still shooting after the
//       ODG's wrap (asked again at snooze_until, like an alarm's snooze)
//   • the countdown in the top bar, the question after the wrap, the week of hours for production
// Rules from Ana (1 Oct 2026). Used by: parts/wrap-clock.js, screens/hours.js, hours-editing.js

import { shootingDays, localTodayIso } from './model.js';

export const WORKDAYS = {
  '10h-lunch': { label: '10h (9 + lunch)', hours: 10 },
  '10h': { label: '10h continuate', hours: 10 },
  '9h': { label: '9h continuate', hours: 9 },
  '8h': { label: '8h continuate', hours: 8 },
};
export const SNOOZE_MINUTES = 60;

export const workdayOf = project => WORKDAYS[project.settings?.workday] ? project.settings.workday : null;

// '18:30' → 1110 (minutes after midnight); '' → null
export function minutesOf(time) {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(time || '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// 1110 → '18:30' (also past midnight: 1530 → '01:30')
export const timeOf = minutes => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// 95 → '1h 35m' · -20 → '0h 20m' (the sign is shown by the caller)
export const span = minutes => `${Math.floor(Math.abs(minutes) / 60)}h ${String(Math.abs(minutes) % 60).padStart(2, '0')}m`;

// for tables: 480 → '8h' · 95 → '1h 35m' · nothing → ''
export const hm = minutes => (minutes === null || minutes === undefined ? '' : span(minutes).replace(' 00m', ''));

// the phone's date and minute: { date: '2026-10-01', minute: 1110 }
export const clockOf = now => ({ date: localTodayIso(now), minute: now.getHours() * 60 + now.getMinutes() });

export const hoursOf = (project, day) => project.hours?.[String(day)] || null;

// Minutes between call and the real wrap (past midnight counts on), and the overtime beyond the
// working day. Null when something is missing.
export function workedOf(project, day) {
  const info = shootingDays(project).find(d => String(d.day) === String(day));
  const hours = hoursOf(project, day);
  const call = minutesOf(info?.call);
  const wrap = minutesOf(hours?.status === 'wrapped' ? hours.real_wrap : null);
  if (call === null || wrap === null) return null;
  const worked = wrap >= call ? wrap - call : wrap + 24 * 60 - call;
  const kind = WORKDAYS[workdayOf(project)];
  return { worked, extra: kind ? Math.max(0, worked - kind.hours * 60) : null };
}

/*  Today, for the top bar and the question:
      null                             not a shooting day (or no wrap on the ODG)
      { phase: 'before', left }        minutes left to the ODG's wrap
      { phase: 'ask' }                 the ODG's wrap has passed: "Did today finish on time?"
      { phase: 'late', over }          still shooting, minutes past the wrap (snoozed)
      { phase: 'ask-wrap', over }      the snooze is over: "Is this a wrap?"
      { phase: 'wrapped' }             done for today
    (+ day, call, wrap of today's ODG)  */
export function today(project, now = new Date()) {
  const { date, minute } = clockOf(now);
  const info = shootingDays(project).find(d => d.date === date);
  const wrap = minutesOf(info?.wrap);
  if (!info || wrap === null) return null;
  const call = minutesOf(info.call);
  // a wrap after midnight (call 18:00, wrap 03:00) belongs to the same day
  const wrapAt = call !== null && wrap < call ? wrap + 24 * 60 : wrap;
  const base = { day: info.day, call: info.call, wrap: info.wrap };
  const hours = hoursOf(project, info.day);
  if (hours?.status === 'wrapped') return { ...base, phase: 'wrapped' };
  if (minute < wrapAt && hours?.status !== 'late') return { ...base, phase: 'before', left: wrapAt - minute };
  const over = Math.max(0, minute - wrapAt);
  if (hours?.status === 'late') {
    const snoozed = hours.snooze_until && now < new Date(hours.snooze_until);
    return { ...base, phase: snoozed ? 'late' : 'ask-wrap', over };
  }
  return { ...base, phase: 'ask', over };
}

// The days of one week (Monday to Sunday) that have shooting, with their hours, for the report.
export function weekOf(project, monday) {
  const end = new Date(monday); end.setDate(end.getDate() + 7);
  const inWeek = d => { const at = new Date(`${d.date}T12:00`); return at >= monday && at < end; };
  return shootingDays(project).filter(inWeek).map(d => {
    const hours = hoursOf(project, d.day);
    return { ...d, real_wrap: hours?.status === 'wrapped' ? hours.real_wrap : '', late: hours?.status === 'late',
      ...(workedOf(project, d.day) || { worked: null, extra: null }) };
  });
}

// Monday 00:00 of the week of `date`
export function mondayOf(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

// the time now, rounded down to 5 minutes: what the wrap question offers ('19:35')
export function nowRounded(now = new Date()) {
  const { minute } = clockOf(now);
  return timeOf(minute - (minute % 5));
}
