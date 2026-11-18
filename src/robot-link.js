// robot-link.js — the app asks the alarms robot (pipeline/gmail-trigger.gs → planAnswer) for the next wake-up plan. The
// robot is the only calculator (Ana, 18 Nov: "multiple alarm calculator systems"): the app does no alarm sums.
//   • the robot link is the one the "soundcheck alarms" shortcut uses (…/exec?key=…): pasted once, kept on THIS
//     phone only (localStorage 'sc_robot_link'), never in the film data — it holds the key
//   • Ana's home address is never here: it is only in the robot (script property HOME_FROM)
//   • the last answer per film is kept on the phone ('sc_robot_plans'): with no signal the app shows it, saying when
//     it was asked
// Used by: parts/robot-plan.js, screens/alarms.js

const LINK = 'sc_robot_link';
const KEPT = 'sc_robot_plans';
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

function keptPlans() {
  try { return JSON.parse(localStorage.getItem(KEPT) || '{}'); } catch { return {}; }
}

// the last answer for this film, or null
export const keptPlan = project => keptPlans()[filmOf(project)] || null;

function keep(project, plan) {
  try { localStorage.setItem(KEPT, JSON.stringify({ ...keptPlans(), [filmOf(project)]: plan })); } catch { /* not kept */ }
}

// asks the robot → the plan with asked_at, { none: true, asked_at }, or { error }.
// choices = the alarm page's numbers not saved yet: that answer is only a preview, so it is not kept.
export async function askPlan(project, choices) {
  const link = robotLink();
  if (!link) return { error: 'no link' };
  const query = new URLSearchParams({ plan: filmOf(project), ...choices });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAIT);
  try {
    const response = await fetch(`${link}&${query}`, { signal: controller.signal });
    const text = await response.text();
    if (!text.trim().startsWith('{')) return { error: 'old robot' }; // the robot's new version is not published yet
    const answer = JSON.parse(text);
    if (answer.error) return { error: answer.error };
    const plan = { ...answer, asked_at: new Date().toISOString() };
    if (!choices) keep(project, plan);
    return plan;
  } catch {
    return { error: 'no signal' };
  } finally {
    clearTimeout(timer);
  }
}
