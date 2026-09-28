// gmail-trigger.gs — Google Apps Script that lives in the production mailbox (sound.chiossi@).
// Every 10 minutes Google runs checkForProductionEmails(): when a NEW email with an ODG, sides
// or PDL has arrived, it starts the "Production emails" robot on GitHub right away
// (GitHub's own timetable in emails.yml is only the backup — it often starts late or not at all).
// Nothing is read or sent anywhere else: it only looks at subjects and message ids, then asks
// GitHub to run the robot, which reads the emails itself.
//
// Setup (once, see docs/HOW_IT_WORKS.md → "Email robot trigger"):
//   1. script.google.com (logged in as sound.chiossi@) → New project → paste this file
//   2. Project settings → Script properties → GITHUB_TOKEN = the GitHub key (Actions: read and write,
//      only the soundcheck-data repository)
//   3. Run setup() once and allow access to Gmail → it creates the 10-minute timer
//   4. Triggers (clock icon) → the timer → Failure notifications: "Notify me immediately"

const REPO = 'anachiossi/soundcheck-data';
const WORKFLOW = 'emails.yml';
const SEARCH = 'has:attachment filename:pdf (subject:ODG OR subject:STRALCI OR subject:PDL) newer_than:3d';
const REMEMBER = 300; // how many message ids to remember (already seen = no new run)

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
  if (!fresh.length) return;

  startRobot(fresh.map(email => email.subject).join(' | '));
  properties.setProperty('SEEN', JSON.stringify([...seen, ...fresh.map(email => email.id)].slice(-REMEMBER)));
  console.log(`Started the robot for: ${fresh.map(email => email.subject).join(', ')}`);
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
