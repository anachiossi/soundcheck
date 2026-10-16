// my-call.js — "My call": which call time a person's OWN hours count from (Projects → My call).
// Each device chooses, kept on the device only (localStorage 'sc_my_call' → state.myCall = { mode, name }):
//   'general'   the day's crew call on the ODG (schedule.json), as always. The default.
//   'personal'  the person's own call: their name as printed on the call sheet, looked up in
//               calls.json ({ '2026-10-12': { 'Maria Rossi': '08:50', … } } → project.crewCalls)
// Name not on that day's call sheet → the crew call, with a note that says so.
// Names match with no capitals, accents or extra spaces ('Inês  Rossi' = 'ines rossi'); the
// ride_with lookup of the wake plan uses the same matching (hours-rules.js).
// Used for the person's own hours only: the Hours screen, the ⏱ wrap clock, the timesheet and the
// wake plan. The Schedule always shows the film's crew call. Only rules here, no screens.
// Used by: hours-rules.js, screens/hours.js, parts/wrap-clock.js, parts/tomorrow.js,
// export/timesheet.js, parts/my-call-switch.js

export const GENERAL_CALL = { mode: 'general', name: '' };
export const NOT_ON_CALL_SHEET = "Your name wasn't on this day's call sheet: using the crew call.";

// 'Inês  Rossi ' → 'ines rossi'
export function plainName(text) {
  const withoutAccents = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return withoutAccents.toLowerCase().trim().split(/\s+/).join(' ');
}

export function sameName(a, b) {
  return plainName(a) === plainName(b);
}

// The call printed next to this name on that date's call sheet (calls.json), or '' when not there.
export function callOnSheet(project, date, name) {
  const calls = project.crewCalls?.[date] || {};
  const found = Object.entries(calls).find(([who]) => sameName(who, name));
  if (!found || typeof found[1] !== 'string') return '';
  return found[1].trim();
}

// Personal call chosen, with a name typed in.
export function isPersonal(setting) {
  return setting?.mode === 'personal' && plainName(setting.name) !== '';
}

// Should the robots follow this choice (hours-editing.js followMyCall)? General: yes.
// Personal: only once a name is typed — "Personal call" tapped with no name yet must not
// remove the name another device saved for the robots.
export function robotsFollow(setting) {
  return setting?.mode === 'general' || isPersonal(setting);
}

// day = { date, call } (call = the day's crew call)
// → { call, source: 'general' | 'personal' | 'fallback', note }
export function myCallFor(project, day, setting) {
  const crewCall = day?.call || '';
  if (!isPersonal(setting)) return { call: crewCall, source: 'general', note: '' };
  const mine = callOnSheet(project, day?.date, setting.name);
  if (mine) return { call: mine, source: 'personal', note: '' };
  return { call: crewCall, source: 'fallback', note: NOT_ON_CALL_SHEET };
}

// The film as the person's own hours see it: every shooting day's call (and the call kept in
// hours/<day>.json for a day whose scenes moved away) is THEIR call. Only for reading: nothing
// is saved from it. General call: the very same film, untouched.
export function withMyCalls(project, setting) {
  if (!isPersonal(setting)) return project;
  const schedule = (project.schedule || []).map(row => ({ ...row, call: myCallFor(project, row, setting).call }));
  const hours = {};
  for (const [day, dayHours] of Object.entries(project.hours || {})) {
    hours[day] = dayHours?.date ? { ...dayHours, call: myCallFor(project, dayHours, setting).call } : dayHours;
  }
  return { ...project, schedule, hours };
}

// The days (of a week on the Hours screen) where the name wasn't on the call sheet.
export function daysNotOnSheet(project, days, setting) {
  return days.filter(day => myCallFor(project, day, setting).source === 'fallback');
}
