// robot-link.js — the alarm page asks the alarms robot (pipeline/gmail-trigger.gs → legsAnswer) for the two legs of
// tomorrow's trip: home → meeting point (on foot or public transport) and meeting point → the ODG's place by car,
// from Google Maps (Ana, 6 Nov: "the distance/time to location be automatic").
//   • the robot link is the one the "soundcheck alarms" shortcut uses (…/exec?key=…): pasted once, kept on THIS
//     phone only (localStorage 'sc_robot_link'), never in the film data — it holds the key
//   • Ana's home address is never here: it is only in the robot (script property HOME_FROM)
//   • each answer is kept on the phone ('sc_robot_legs'), so with no signal the page shows the last one, marked as such
// Used by: screens/alarms.js

const LINK = 'sc_robot_link';
const KEPT = 'sc_robot_legs';
const WAIT = 20000; // Google can take a while; then the last answer kept

export function robotLink() {
  try { return localStorage.getItem(LINK) || ''; } catch { return ''; }
}

// a link pasted from the shortcut: only a Google Apps Script web app with its key is kept
export function setRobotLink(text) {
  const link = String(text || '').trim();
  if (link && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\?key=[^&\s]+$/.test(link)) return false;
  try { link ? localStorage.setItem(LINK, link) : localStorage.removeItem(LINK); } catch { return false; }
  return true;
}

const filmOf = project => String(project.folder || '').split('/').pop();
const keyOf = (project, date, meet, choices) => JSON.stringify([filmOf(project), date, meet, choices]);

function keptAnswers() {
  try { return JSON.parse(localStorage.getItem(KEPT) || '{}'); } catch { return {}; }
}

// the last answer for exactly this question, or null: { drive, toMeeting, asked_at }
export function keptLegs(project, date, meet, choices) {
  return keptAnswers()[keyOf(project, date, meet, choices)] || null;
}

// asks the robot; { drive, toMeeting, asked_at } or { error }. choices = the page's { drive_to, to_meeting, drive_margin }
export async function askLegs(project, date, meet, choices) {
  const link = robotLink();
  if (!link) return { error: 'no link' };
  const query = new URLSearchParams({ legs: filmOf(project), date, meet });
  for (const [name, value] of Object.entries(choices)) if (value !== '' && value !== undefined) query.set(name, value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAIT);
  try {
    const response = await fetch(`${link}&${query}`, { signal: controller.signal });
    const answer = await response.json();
    if (answer.error || !answer.drive) return { error: answer.error || 'no answer' };
    const kept = keptAnswers();
    const entries = Object.entries({ ...kept, [keyOf(project, date, meet, choices)]: { ...answer, asked_at: new Date().toISOString() } });
    try { localStorage.setItem(KEPT, JSON.stringify(Object.fromEntries(entries.slice(-30)))); } catch { /* not kept */ }
    return { ...answer, asked_at: new Date().toISOString() };
  } catch {
    return { error: 'no signal' };
  } finally {
    clearTimeout(timer);
  }
}
