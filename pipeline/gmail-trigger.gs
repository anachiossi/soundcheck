// gmail-trigger.gs — Google Apps Script that lives in the production mailbox (sound.chiossi@).
// Every 10 minutes Google runs checkForProductionEmails(): when a NEW email with an ODG, sides
// or PDL has arrived, it starts the "Production emails" robot on GitHub right away
// (GitHub's own timetable in emails.yml is only the backup — it often starts late or not at all).
// Nothing is read or sent anywhere else: it only looks at subjects and message ids, then asks
// GitHub to run the robot, which reads the emails itself. At every check it also leaves the time
// on GitHub (variable LAST_GMAIL_CHECK), so the app's ✉ badge can show "checked 8 min ago".
// Wrap alerts: at every check it also looks at today's ODG wrap and Ana's answer in the app
// (schedule.json, hours/<day>.json) and, when a question is due, starts the "Wrap alerts" robot,
// which sends the notification to her phone ("Did today finish on time?", then hourly "Is this a wrap?").
//
// Setup (once, see docs/HOW_IT_WORKS.md → "Email robot trigger"):
//   1. script.google.com (logged in as sound.chiossi@) → New project → paste this file
//   2. Project settings → Script properties → GITHUB_TOKEN = the GitHub key (only the soundcheck-data
//      repository; Actions: read and write, Variables: read and write, Contents: read-only)
//   3. Run setup() once and allow access to Gmail → it creates the 10-minute timer
//   4. Triggers (clock icon) → the timer → Failure notifications: "Notify me immediately"

const REPO = 'anachiossi/soundcheck-data';
const WORKFLOW = 'emails.yml';
const SEARCH = 'has:attachment filename:pdf (subject:ODG OR subject:STRALCI OR subject:PDL) newer_than:3d';
const REMEMBER = 300; // how many message ids to remember (already seen = no new run)
const TIME_ZONE = 'Europe/Rome';
const ALERTS = 'wrap-alerts.yml';
const GIVE_UP_AFTER = 8 * 60; // minutes after the ODG's wrap: no more questions

function setup() {
  ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('checkForProductionEmails').timeBased().everyMinutes(10).create();
  checkForProductionEmails();
}

function checkForProductionEmails() {
  const properties = PropertiesService.getScriptProperties();
  const seen = JSON.parse(properties.getProperty('SEEN') || '[]');
  const fresh = [];
  // a reply with the sides is a new message in the ODG's thread, so look at every message
  GmailApp.search(SEARCH, 0, 50).forEach(thread => thread.getMessages().forEach(message => {
    const id = message.getId();
    if (!seen.includes(id) && message.getAttachments().some(file => /\.pdf$/i.test(file.getName()))) {
      fresh.push({ id, subject: message.getSubject() });
    }
  }));
  if (fresh.length) {
    startRobot(fresh.map(email => email.subject).join(' | '));
    properties.setProperty('SEEN', JSON.stringify([...seen, ...fresh.map(email => email.id)].slice(-REMEMBER)));
    console.log(`Started the robot for: ${fresh.map(email => email.subject).join(', ')}`);
  }
  reportChecked();
  try { checkWrapAlerts(); } catch (error) { console.warn(`Wrap alerts: ${error.message}`); } // never stops the emails
}

// ---- Wrap alerts ------------------------------------------------------------------------------
// For every film with a working day (settings.json "workday") and at least one phone (push/):
// today's ODG wrap (schedule.json) passed and no answer yet → "Did today finish on time?";
// answered "Not yet" (hours/<day>.json status 'late') and the snooze is over → "Is this a wrap?".
// Each question goes out once (remembered in the script properties).
function checkWrapAlerts() {
  const now = new Date();
  const today = Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd');
  const minute = Number(Utilities.formatDate(now, TIME_ZONE, 'H')) * 60 + Number(Utilities.formatDate(now, TIME_ZONE, 'm'));
  const properties = PropertiesService.getScriptProperties();
  const sent = JSON.parse(properties.getProperty('WRAP_SENT') || '[]');
  for (const film of (readRepo('projects') || []).filter(item => item.type === 'dir').map(item => item.name)) {
    const phones = readRepo(`projects/${film}/push`);
    if (!phones || !phones.length) continue;
    const settings = readRepo(`projects/${film}/settings.json`, true);
    if (!settings || !settings.workday) continue;
    const day = (readRepo(`projects/${film}/schedule.json`, true) || [])
      .filter(row => row.date === today && row.wrap).sort((a, b) => a.order - b.order)[0];
    if (!day) continue;
    const call = minutesOf(day.call);
    let wrap = minutesOf(day.wrap);
    if (call !== null && wrap < call) wrap += 24 * 60; // a wrap after midnight
    const over = minute - wrap;
    if (over < 0 || over > GIVE_UP_AFTER) continue;
    const hours = readRepo(`projects/${film}/hours/${day.day}.json`, true);
    let key, title, body;
    if (hours && hours.status === 'wrapped') continue;
    if (!hours || hours.status !== 'late') {
      key = `${film}|${day.day}|ask`; title = 'Did today finish on time?'; body = `Day ${day.day} · ODG wrap ${day.wrap}`;
    } else if (hours.snooze_until && new Date(hours.snooze_until) <= now) {
      key = `${film}|${day.day}|${hours.snooze_until}`; title = 'Is this a wrap?';
      body = `Day ${day.day} · +${Math.floor(over / 60)}h ${String(over % 60).padStart(2, '0')}m after the ODG wrap`;
    } else continue;
    if (sent.includes(key)) continue;
    startWorkflow(ALERTS, { film, title, body });
    sent.push(key);
    properties.setProperty('WRAP_SENT', JSON.stringify(sent.slice(-100)));
    console.log(`Wrap alert for ${film}: ${title}`);
  }
}

function minutesOf(time) {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(time || '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// A file of the data repo (json = true: parsed) or a folder's list; null when it isn't there.
function readRepo(path, json) {
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}`, {
    headers: { Authorization: `Bearer ${PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')}`,
               Accept: json ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' },
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code === 404) return null;
  if (code === 403) throw new Error('the GitHub key needs "Contents: Read-only" for the wrap alerts.');
  if (code >= 300) throw new Error(`GitHub said ${code} for ${path}`);
  return JSON.parse(response.getContentText());
}

function startWorkflow(workflow, inputs) {
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')}`,
               Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main', inputs }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 204) throw new Error(`GitHub said ${response.getResponseCode()}: ${response.getContentText()}`);
}

// "Gmail was checked now" → GitHub variable LAST_GMAIL_CHECK (read by the app's ✉ badge).
// Never fails the check: without the Variables permission the robot still starts.
function reportChecked() {
  const url = `https://api.github.com/repos/${REPO}/actions/variables`;
  const body = { name: 'LAST_GMAIL_CHECK', value: new Date().toISOString() };
  let code = github(`${url}/LAST_GMAIL_CHECK`, 'patch', body).getResponseCode();
  if (code === 404) code = github(url, 'post', body).getResponseCode(); // the first time: create it
  if (code >= 300) console.warn(`Couldn't report the check to GitHub (${code}): add "Variables: read and write" to the key.`);
}

function github(url, method, body) {
  return UrlFetchApp.fetch(url, {
    method,
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')}`,
               Accept: 'application/vnd.github+json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
}

function startRobot(reason) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN is missing (Project settings → Script properties).');
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true,
  });
  // 204 = started. Anything else throws, so Google emails a failure notice (and the emails stay
  // "not seen", so the next check tries again).
  if (response.getResponseCode() !== 204) {
    throw new Error(`GitHub said ${response.getResponseCode()}: ${response.getContentText()} (${reason})`);
  }
}
