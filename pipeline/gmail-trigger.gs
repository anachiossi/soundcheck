// gmail-trigger.gs — Google Apps Script that lives in the production mailbox.
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
//   1. script.google.com (logged in as the production mailbox) → New project → paste this file
//   2. Project settings → Script properties → GITHUB_TOKEN = the GitHub key (only the soundcheck-data
//      repository; Actions: read and write, Variables: read and write, Contents: read-only)
//      (optional) REPO = owner/name of the film's own data repo; empty = anachiossi/soundcheck-data
//   3. Run setup() once and allow access to Gmail → it creates the 10-minute timer
//   4. Triggers (clock icon) → the timer → Failure notifications: "Notify me immediately"

// The data repo it watches. One repo per film (docs/CREW_SHARING.md → "Setting up the next film"):
// set the script property REPO = 'owner/name' of the film's repo; without it, soundcheck-data as before.
const DEFAULT_REPO = 'anachiossi/soundcheck-data';
function repo() {
  return PropertiesService.getScriptProperties().getProperty('REPO') || DEFAULT_REPO;
}
const WORKFLOW = 'emails.yml';
// subject (LBE: "LBE - ODG #7") or the file names (Il colpo, forwarded from WhatsApp with any subject:
// "IC - OdgDAY_53_30.10.26.pdf", "IL COLPO_OverTime…", 3 Nov)
const SEARCH = 'has:attachment filename:pdf (subject:ODG OR subject:STRALCI OR subject:PDL OR filename:odg OR filename:stralci OR filename:pdl OR filename:IC OR filename:colpo) newer_than:3d';
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
  try { checkBedtime(); } catch (error) { console.warn(`Bedtime: ${error.message}`); }
  try { checkAlarmChange(); } catch (error) { console.warn(`Alarm email: ${error.message}`); }
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

// ---- Bedtime --------------------------------------------------------------------------------
// The evening before a shooting day, at the time to sleep (the film's wake-up plan, settings.json
// "commute": call − meeting − travel − getting ready − sleep hours; same as the app): "💤 Time to sleep".
// walk_to_ride: minutes on foot to the ride's house first (Il colpo 20, Ana 3 Nov).
// travel: "maps" → the drive is asked to Google Maps (travelMinutes below), else travel_max.
// leave_alarm_before: the "leave" alarm rings this many minutes before walking out (0; Il colpo 15).
const COMMUTE = { meet_before_call: 45, travel_min: 75, travel_max: 90, get_ready: 45, sleep_hours: 8, walk_to_ride: 0,
  leave_alarm_before: 0 };

// Not when still working: a night shoot (17:00–01:00) ends after the time to sleep for the next call.
function checkBedtime() {
  const now = new Date();
  const properties = PropertiesService.getScriptProperties();
  const sent = JSON.parse(properties.getProperty('WRAP_SENT') || '[]');
  for (const plan of upcomingPlans(now)) {
    const key = `${plan.film}|bed|${plan.date}`;
    const bedtime = plan.wake.getTime() - plan.sleepHours * 3600 * 1000;
    if (sent.includes(key) || now.getTime() < bedtime || now.getTime() > bedtime + 3 * 3600 * 1000) continue;
    if (plan.previousWrap && plan.previousWrap.getTime() > bedtime) continue; // still on set at bedtime
    const phones = readRepo(`projects/${plan.film}/push`);
    if (!phones || !phones.length) continue;
    startWorkflow(ALERTS, { film: plan.film, title: '💤 Time to sleep', url: './#hours', tag: 'sleep',
      body: `D${String(plan.day).padStart(2, '0')}: wake ${clockAt(plan.wake)} · call ${clockOf(plan.call)}` });
    sent.push(key);
    properties.setProperty('WRAP_SENT', JSON.stringify(sent.slice(-100)));
    console.log(`Bedtime for ${plan.film}: wake ${clockAt(plan.wake)}`);
  }
}

// ---- The wake-up plans --------------------------------------------------------------------------------
// Every shooting day of the next 3 calendar days with its wake and leave as real moments (Ana, 3 Nov: night
// shoots — a day 19:00–02:00 can be followed by a call later that SAME calendar day). Per film with a "commute":
//   start = the ride's call (or Ana's own) · meet = start − meet_before_call
//   leave = meet − drive − walk_to_ride · wake = leave − get_ready
// The MAIN unit's call only (a 2nd unit's rows have unit '2nd').
function upcomingPlans(now) {
  const plans = [];
  const dates = [0, 1, 2].map(n => Utilities.formatDate(new Date(now.getTime() + n * 86400000), TIME_ZONE, 'yyyy-MM-dd'));
  for (const film of (readRepo('projects') || []).filter(item => item.type === 'dir').map(item => item.name)) {
    const settings = readRepo(`projects/${film}/settings.json`, true);
    if (!settings || !settings.commute) continue;
    const c = Object.assign({}, COMMUTE, settings.commute);
    const schedule = withWaitingOdgTimes(readRepo(`projects/${film}/schedule.json`, true) || [], openOdgs(film));
    const main = schedule.filter(row => row.date && row.call && !row.unit);
    const calls = c.ride_with || c.my_name ? readRepo(`projects/${film}/calls.json`, true) || {} : {};
    const places = c.travel === 'maps' ? readRepo(`projects/${film}/locations.json`, true) || {} : {};
    for (const date of dates) {
      const row = main.filter(r => r.date === date).sort((a, b) => a.order - b.order)[0];
      if (!row) continue;
      const own = ownCall(c, row.call, calls[date]);
      const start = rideStart(c, own, calls[date]);
      if (start === null || start === undefined) continue;
      const meet = start - c.meet_before_call;
      const drive = travelMinutes(c, places[date], date, meet);
      const leave = meet - drive.minutes - c.walk_to_ride;  // walking out of the house
      const before = main.filter(r => r.date < date && r.wrap).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      plans.push({ film, date, day: row.day, call: own, sleepHours: c.sleep_hours, drive,
        // the "leave" alarm rings leave_alarm_before minutes before walking out (Ana, 3 Nov: a 15-minute heads-up)
        leave: moment(date, leave - c.leave_alarm_before), wake: moment(date, leave - c.get_ready),
        previousWrap: before ? wrapMoment(before) : null });
    }
  }
  return plans;
}

// the end of a day: its wrap, the next calendar day when it is earlier than the call (17:00–01:00)
function wrapMoment(row) {
  const call = minutesOf(row.call);
  const wrap = minutesOf(row.wrap);
  return moment(row.date, call !== null && wrap <= call ? wrap + 24 * 60 : wrap);
}

// The drive from the ride's house to that day's place (locations.json, from the ODG: crew parking, else the
// set), asked to Google Maps for the time you leave — Google's time only (Ana, 3 Nov: the margin is the leave
// alarm's heads-up, not the drive). The ride's address is ONLY the script property RIDE_FROM (never in the data).
// No address, no place, or Maps fails → travel_max, as before.
function travelMinutes(c, place, date, meet) {
  const from = PropertiesService.getScriptProperties().getProperty('RIDE_FROM');
  if (c.travel !== 'maps' || !from || !place) return { minutes: c.travel_max, maps: false };
  const to = placeOf(place);
  const cache = CacheService.getScriptCache();
  const key = `drive|${date}|${meet}|${to}`.slice(0, 240);
  const kept = cache.get(key);
  if (kept) return { minutes: Number(kept), maps: true };
  try {
    let minutes = c.travel_max;
    for (let pass = 0; pass < 2; pass++) {  // leaving earlier changes the traffic: ask again with the new time
      const depart = moment(date, meet - minutes);
      const finder = Maps.newDirectionFinder().setOrigin(from).setDestination(to).setMode(Maps.DirectionFinder.Mode.DRIVING);
      if (depart.getTime() > Date.now()) finder.setDepart(depart);
      const leg = (((finder.getDirections().routes || [])[0] || {}).legs || [])[0];
      if (!leg) throw new Error(`no route to ${to}`);
      // duration = Google's usual time for that road; duration_in_traffic (when Google gives it for a time of
      // leaving) = its best guess with the traffic of that weekday and hour. The longer of the two is used.
      minutes = Math.ceil(Math.max(leg.duration.value, (leg.duration_in_traffic || leg.duration).value) / 60);
      console.log(`Drive on ${date}: ${minutes} min (${leg.duration_in_traffic ? 'with traffic' : 'usual time, no traffic figure'})`);
    }
    cache.put(key, String(minutes), 6 * 3600);
    return { minutes, maps: true };
  } catch (error) {
    console.warn(`Travel time: ${error.message}`);
    return { minutes: c.travel_max, maps: false };
  }
}

// An ODG's Google Maps link → 'lat,lng' or the full address in the link (one redirect, kept 6 hours):
//   …/place/Campo+di+mare/@41.97,12.03…!3d41.9729408!4d12.0376639 · maps.google.com/?q=41.732979,12.318095 ·
//   …/place/Via+Furbara+Sasso,+94e,+00052+Cerveteri+RM/… (the ODG's own text has no town: "Via Furbara Sasso 94 E")
function placeOf(place) {
  if (!place.link) return place.text;
  const cache = CacheService.getScriptCache();
  const kept = cache.get(`place|${place.link}`.slice(0, 240));
  if (kept) return kept;
  let found = place.text;
  try {
    const headers = UrlFetchApp.fetch(place.link, { followRedirects: false, muteHttpExceptions: true }).getHeaders();
    const where = headers.Location || headers.location || '';
    const exact = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(where) || /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(where);
    const named = /\/maps\/place\/([^/@]+)/.exec(where);
    if (exact) found = `${exact[1]},${exact[2]}`;
    else if (named) found = decodeURIComponent(named[1].replace(/\+/g, ' '));
  } catch (error) {
    console.warn(`Map link: ${error.message}`);
  }
  cache.put(`place|${place.link}`.slice(0, 240), found, 6 * 3600);
  return found;
}

// 'YYYY-MM-DD' + minutes from that day's midnight in Rome (negative = the day before) → the real moment
function moment(date, minutes) {
  return new Date(Utilities.parseDate(`${date} 00:00`, TIME_ZONE, 'yyyy-MM-dd HH:mm').getTime() + minutes * 60000);
}
const clockAt = when => Utilities.formatDate(when, TIME_ZONE, 'HH:mm');

// ---- Alarms, automatic ----------------------------------------------------------------------------
// The iPhone asks this every evening (a Shortcuts automation at 21:00 and 23:00, Ana 9 Oct: she didn't
// tap ⏰ and the alarm wasn't set): https://script.google.com/macros/s/…/exec?key=<ALARM_KEY>
// Answer, as plain text:
//   06:00;06:45  the next wake-up within 24 hours: wake and leave (the same sums as the app's ⏰ Set alarms)
//   none         no wake-up in the next 24 hours (weekend, day off): the shortcut deletes the soundcheck alarms
//   error        something failed: the shortcut keeps the alarms as they are and says so
// "Next" = the first wake still ahead (alarmAnswer): after a night shoot, the same day's afternoon call; a Monday
// call is never set on Friday (Sunday's run sets it). The times of an ODG not yet reviewed count already, like
// in the app (hours-rules.js → withWaitingOdgTimes). Several films shooting: the earliest wake.
// Setup: Script properties → ALARM_KEY = a long random word; Deploy → New deployment → Web app,
// Execute as: Me, Who has access: Anyone. See docs/HOW_IT_WORKS.md → "Automatic alarms".
function doGet(e) {
  const key = PropertiesService.getScriptProperties().getProperty('ALARM_KEY');
  if (!key || !e || !e.parameter || e.parameter.key !== key) return ContentService.createTextOutput('wrong key');
  if (e.parameter.calendar) {  // the phone's subscribed calendar (see calendarOf below)
    return ContentService.createTextOutput(calendarOf(e.parameter.calendar, new Date()))
      .setMimeType(ContentService.MimeType.ICAL);
  }
  // any failure (GitHub down, a bad file) answers 'error', never 'none': the shortcut deletes alarms only on
  // a clear 'none' (Ana, 10 Oct: "I'm so afraid it could erase a good alarm")
  let answer;
  try { answer = alarmAnswer(new Date()); } catch (error) { console.warn(`Alarms: ${error.message}`); answer = 'error'; }
  return ContentService.createTextOutput(answer);
}

// The next wake-up that is still ahead and within 24 hours (Ana, 3 Nov, night shoots: after a 19:00–02:00 day
// the next call can be that same afternoon). More than 24 hours away (Friday → Monday) → 'none': an iPhone
// alarm is a time of day, so a far one would ring too early; a run within the 24 hours sets it.
function alarmAnswer(now) {
  const ahead = upcomingPlans(now)
    .filter(plan => plan.wake.getTime() > now.getTime() && plan.wake.getTime() - now.getTime() <= 24 * 3600 * 1000)
    .sort((a, b) => a.wake - b.wake);
  if (!ahead.length) return 'none';
  return `${clockAt(ahead[0].wake)};${clockAt(ahead[0].leave)}`;
}

// ---- Phone calendar -------------------------------------------------------------------------------
// Apple Calendar subscribes to …/exec?key=<ALARM_KEY>&calendar=<film> (Settings → Calendar → Accounts →
// Add Account → Other → Add Subscribed Calendar) and reads it again by itself: a new PDL or ODG moves the
// events, no copy goes stale (Ana, 3 Nov). Which days: the film's settings "calendar":
//   "days_with_2nd_unit" → only the days with a 2nd unit (Ana's working days on Il colpo); "all" → every day.
// One event per day, from the MAIN unit's call to its wrap (Ana works the main unit); the 2nd unit's hours
// are in the notes. Only the day, the times and the unit's name: no scenes, no people.
function calendarOf(film, now) {
  const settings = readRepo(`projects/${film}/settings.json`, true) || {};
  const tag = ((readRepo(`projects/${film}/film.json`, true) || {}).tag || film).toUpperCase();
  const schedule = withWaitingOdgTimes(readRepo(`projects/${film}/schedule.json`, true) || [], openOdgs(film));
  const days = {};
  for (const row of schedule) {
    const day = days[row.day] = days[row.day] || { day: row.day };
    if (row.unit) day.second = day.second || row;
    else if (!day.main || row.order < day.main.order) day.main = row;
  }
  const wanted = Object.values(days).filter(d => d.main && d.main.date && (settings.calendar !== 'days_with_2nd_unit' || d.second));
  const stamp = when => Utilities.formatDate(when, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  const text = value => String(value).replace(/[\\;,]/g, m => `\\${m}`);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//soundcheck//calendar//EN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:soundcheck · ${tag}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const d of wanted) {
    const call = minutesOf(d.main.call);
    const wrap = minutesOf(d.main.wrap);
    const second = d.second ? `2nd unit ${d.second.unit_name || ''} ${d.second.call && d.second.wrap ? `${d.second.call}–${d.second.wrap}` : '(hours not given)'}` : '';
    lines.push('BEGIN:VEVENT', `UID:${film}-day-${d.day}@soundcheck`, `DTSTAMP:${stamp(now)}`,
      `SUMMARY:${text(`${tag} D${d.day}${call === null ? '' : ` · call ${d.main.call}`}${d.second ? ' · 2nd unit day' : ''}`)}`,
      `DESCRIPTION:${text(`Main unit ${d.main.call || '?'}–${d.main.wrap || '?'}${second ? `. ${second.trim()}` : ''}. From soundcheck: follows the PDL and ODGs.`)}`);
    if (call === null) {  // no time yet: an all-day event
      const next = Utilities.formatDate(moment(d.main.date, 24 * 60 + 60), TIME_ZONE, 'yyyyMMdd');
      lines.push(`DTSTART;VALUE=DATE:${d.main.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next}`);
    } else {
      const end = wrap === null ? call + 10 * 60 : wrap <= call ? wrap + 24 * 60 : wrap; // 17:00–01:00 ends the next day
      lines.push(`DTSTART:${stamp(moment(d.main.date, call))}`, `DTEND:${stamp(moment(d.main.date, end))}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}


// Riding with someone (settings commute.ride_with, Ana 11 Oct: a colleague from costumes): the plan starts from
// THAT person's call on the ODG (calls.json, written by pipeline/run.py); not known yet → Ana's call −
// ride_gap_if_unknown (40). Same as hours-rules.js → rideCall.
function rideStart(c, call, dayCalls) {
  if (call === null || call === undefined || !c.ride_with) return call;
  const theirs = callOf(c.ride_with, dayCalls);
  return theirs === null ? call - (c.ride_gap_if_unknown == null ? 40 : c.ride_gap_if_unknown) : theirs;
}

// Ana's own call (settings commute.my_name, saved by the app when she picks "Personal call" in My call,
// Ana 16 Oct): her name's call on that day's calls.json; not there (or no my_name) → the day's general call.
// Same as the app (my-call.js) and pipeline/wake_plan.py → own_call.
// After changing this file: script.google.com → Deploy → Manage deployments → ✎ → Version: New version,
// or the alarms web app keeps running the old code (the 10-minute timer picks up the saved file by itself).
function ownCall(c, generalCall, dayCalls) {
  const mine = c.my_name ? callOf(c.my_name, dayCalls) : null;
  return mine === null ? minutesOf(generalCall) : mine;
}

// The call printed next to this name that day, in minutes, or null. Names match with no capitals, accents
// or extra spaces ('Inês  Rossi' = 'ines rossi'), like the app's plainName (my-call.js).
function callOf(name, dayCalls) {
  const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().split(/\s+/).join(' ');
  if (!plain(name)) return null;
  const found = Object.keys(dayCalls || {}).find(who => plain(who) === plain(name));
  return found ? minutesOf(dayCalls[found]) : null;
}

const clockOf = m => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;

// When the answer changes (a new ODG, a changed call, a day off), an email "soundcheck alarms" goes to
// ALARM_MAIL (Script properties; none = off). On the iPhone, a Mail automation (subject contains
// "soundcheck alarms") runs the same shortcut — so the alarms follow the ODG without waiting for 20:00.
// An 'error' is never sent; the last answer sent is remembered (ALARM_LAST).
function checkAlarmChange() {
  const properties = PropertiesService.getScriptProperties();
  const to = properties.getProperty('ALARM_MAIL');
  if (!to) return;
  const answer = alarmAnswer(new Date());
  if (answer === properties.getProperty('ALARM_LAST')) return;
  // only the newest signal stays: the previous ones go to the trash, inbox and Sent (Ana, 10 Oct)
  GmailApp.search('subject:"soundcheck alarms"', 0, 50).forEach(thread => thread.moveToTrash());
  MailApp.sendEmail(to, 'soundcheck alarms', `${answer}

Sent by the robot when the next morning's alarms change. The iPhone's automation asks the robot itself; this email is only the signal.`);
  properties.setProperty('ALARM_LAST', answer);
  console.log(`Alarm email: ${answer}`);
}

// the last few ODG proposals still open (odg-<day>.json)
function openOdgs(film) {
  const files = (readRepo(`projects/${film}/proposals`) || []).map(item => item.name).filter(name => /^odg-\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).slice(-3);
  return files.map(name => readRepo(`projects/${film}/proposals/${name}`, true)).filter(p => p && p.status === 'open');
}

// the date / call / wrap of the changes not yet decided count (as in the app); the newest ODG wins
function withWaitingOdgTimes(schedule, odgs) {
  for (const proposal of odgs.sort((a, b) => (a.day || 0) - (b.day || 0))) {
    for (const change of proposal.changes || []) {
      const op = change.op;
      if ((proposal.decisions || {})[change.id] || !op || op.unit) continue; // a 2nd unit's times never move the alarm
      const fields = {};
      for (const k of ['date', 'call', 'wrap']) if (op.fields && op.fields[k]) fields[k] = op.fields[k];
      if (!Object.keys(fields).length) continue;
      const known = schedule.some(row => row.day === op.day && !row.unit);
      if (op.op === 'set_day' || (op.op === 'set_day_scenes' && known)) {
        schedule = schedule.map(row => (row.day === op.day && !row.unit ? Object.assign({}, row, fields) : row));
      } else if (op.op === 'set_day_scenes') {
        schedule = schedule.concat([Object.assign({ day: op.day, order: 1, scene_id: '' }, fields)]);
      }
    }
  }
  return schedule;
}

function minutesOf(time) {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(time || '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// A file of the data repo (json = true: parsed) or a folder's list; null when it isn't there.
function readRepo(path, json) {
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${repo()}/contents/${encodeURI(path)}`, {
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
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${repo()}/actions/workflows/${workflow}/dispatches`, {
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
  const url = `https://api.github.com/repos/${repo()}/actions/variables`;
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
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${repo()}/actions/workflows/${WORKFLOW}/dispatches`, {
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
