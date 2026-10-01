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

// A shooting day with its hours, for the report: { day, date, call, wrap, real_wrap, late, worked, extra }
function withHours(project, d) {
  const hours = hoursOf(project, d.day);
  return { ...d, real_wrap: hours?.status === 'wrapped' ? hours.real_wrap : '', late: hours?.status === 'late',
    ...(workedOf(project, d.day) || { worked: null, extra: null }) };
}

// The days of one week (Monday to Sunday) that have shooting, with their hours.
export function weekOf(project, monday) {
  const end = new Date(monday); end.setDate(end.getDate() + 7);
  const inWeek = d => { const at = new Date(`${d.date}T12:00`); return at >= monday && at < end; };
  return shootingDays(project).filter(inWeek).map(d => withHours(project, d));
}

// The whole film, week by week: [{ monday, days: [...] }]
export function filmWeeks(project) {
  const weeks = new Map();
  for (const d of shootingDays(project)) {
    const monday = mondayOf(new Date(`${d.date}T12:00`));
    const key = monday.getTime();
    if (!weeks.has(key)) weeks.set(key, { monday, days: [] });
    weeks.get(key).days.push(withHours(project, d));
  }
  return [...weeks.values()].sort((a, b) => a.monday - b.monday);
}

export const extraOf = days => days.reduce((sum, d) => sum + (d.extra || 0), 0);

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

// ---- the night before: when to sleep, wake up and leave (Ana's "hora de acordar", 1 Oct) ----
// settings.json → "commute" (per film; a film that moves every day will change them per day):
//   meet_before_call  the meeting point, minutes before the call (45)
//   travel_min / travel_max  from home to the meeting point (75 / 90): the window to leave
//   get_ready         from waking up to leaving (45) · sleep_hours (8)
// call 09:00 → meeting 08:15 · leave 06:45–07:00 · wake 06:00 · sleep 22:00 (the night before)
export const COMMUTE = { meet_before_call: 45, travel_min: 75, travel_max: 90, get_ready: 45, sleep_hours: 8 };
export const commuteOf = project => (project.settings?.commute ? { ...COMMUTE, ...project.settings.commute } : null);

const clock = minutes => timeOf(((minutes % 1440) + 1440) % 1440); // -45 → '23:15'

export function wakePlan(project, day) {
  const commute = commuteOf(project);
  const call = minutesOf(day?.call);
  if (!commute || call === null) return null;
  const meet = call - commute.meet_before_call;
  const leaveFrom = meet - commute.travel_max;
  const wake = leaveFrom - commute.get_ready;
  return { day: day.day, date: day.date, call: day.call, meet: clock(meet), leaveFrom: clock(leaveFrom),
    leaveTo: clock(meet - commute.travel_min), wake: clock(wake), sleep: clock(wake - commute.sleep_hours * 60) };
}

// the next shooting day whose call is still ahead: later today (after midnight, the day you are about
// to wake up for — Ana, 00:15), tomorrow, or Monday after a weekend
export function nextShootingDay(project, now = new Date()) {
  const { date: today, minute } = clockOf(now);
  const ahead = d => d.date > today || (d.date === today && (minutesOf(d.call) ?? 0) > minute);
  return shootingDays(project).filter(ahead).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
