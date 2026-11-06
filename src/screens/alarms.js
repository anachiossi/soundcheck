// alarms.js — the alarm page (Hours → ⏰ Alarm page, or #alarms). Ana, 5–6 Nov: "home → meeting point by mezzi or walk
// (under 1 km), meeting point → location by car … as I change the values it shows the result … a large button that
// says set alarm now". The robot keeps setting the alarms by itself every evening; this page is the same thing by hand.
//   • the next shooting day (hours-rules.js nextShootingDay) and the call it follows (My call, or the ride's call)
//   • the two legs come from the robot (robot-link.js → gmail-trigger.gs commuteLegs): Google Maps for that day and
//     hour, with the page's choices even before they are saved; the SAME sums as the automatic alarms
//   • no signal: the last answer kept on the phone, marked; none at all: the film's longest drive (travel_max)
//   • Save → the film's settings.json "commute" (the robot uses them tonight); ⏰ Set alarm now → saves, then runs the
//     "soundcheck alarms" shortcut with wake · film · leave (parts/tomorrow.js alarmsLink)
// Used by: main.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { formatDate } from '../model.js';
import { commuteOf, wakePlan, nextShootingDay } from '../hours-rules.js';
import { myCallFor } from '../my-call.js';
import { saveSettings } from '../kit-editing.js';
import { showScreen } from '../state.js';
import { alarmsLink } from '../parts/tomorrow.js';
import { AlarmFields, cleanCommute, savedCommute } from '../parts/alarm-fields.js';
import { askLegs, keptLegs, robotLink, setRobotLink } from '../robot-link.js';

const CHOICES = ['drive_to', 'to_meeting', 'drive_margin'];
const ASK_AFTER = 800; // ms after the last change: Google is asked once, not at every key

export function AlarmsScreen({ state }) {
  const { project, myCall } = state;
  const saved = commuteOf(project) || {};
  const [values, setValues] = useState(() => ({ ...saved }));
  const [legs, setLegs] = useState(null);       // the robot's answer (or the one kept)
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState('');
  const [link, setLink] = useState(robotLink());

  const day = nextShootingDay(project);
  const commute = cleanCommute(values);
  const draft = day && wakePlan(project, { ...day, call: myCallFor(project, day, myCall).call }, { commute });
  const choices = Object.fromEntries(CHOICES.map(key => [key, commute[key] ?? '']));
  const meet = draft?.meet;

  useEffect(() => {
    if (!draft) return undefined;
    setLegs(keptLegs(project, draft.date, meet, choices));
    if (!link) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAsking(true);
      const answer = await askLegs(project, draft.date, meet, choices);
      if (cancelled) return;
      setAsking(false);
      if (answer.error) setProblem(answer.error === 'no signal' ? 'No signal: showing the last answer kept on this phone.' : `The robot said: ${answer.error}`);
      else { setProblem(''); setLegs(answer); }
    }, ASK_AFTER);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draft?.date, meet, JSON.stringify(choices), link]);

  if (!day || !draft) {
    return html`<button class="link back" onClick=${() => showScreen('hours')}>‹ Hours</button>
      <p class="empty">No next shooting day with a call time yet.</p>`;
  }
  const plan = wakePlan(project, { ...day, call: myCallFor(project, day, myCall).call }, { commute, legs });
  const dayPlace = project.dayPlaces?.[day.date];
  const people = Object.keys(project.crewCalls?.[day.date] || {}).sort();
  const save = message => saveSettings({ commute: savedCommute(project.settings?.commute, commute) }, message);
  const changed = JSON.stringify(cleanCommute(saved)) !== JSON.stringify(commute);

  return html`
    <button class="link back" onClick=${() => showScreen('hours')}>‹ Hours</button>
    <section class="tomorrow alarms">
      <p class="tomorrow__day"><b>⏰ D${plan.day}</b> · ${formatDate(plan.date, { weekday: true })} · call <b>${plan.call}</b>
        ${plan.rideWith && html` · 🚗 ${plan.rideWith.split(' ')[0]} ${plan.rideCall || '(call not known yet)'}`}</p>
      <div class="tomorrow__times alarms__times">
        <span><small>💤 sleep</small><b>${plan.sleep}</b></span>
        <span><small>⏰ wake</small><b>${plan.wake}</b></span>
        <span><small>🚪 leave home</small><b>${plan.leaveFrom}</b><small>⏰ ${plan.leaveAlarm}</small></span>
        <span><small>🚇 meeting point</small><b>${plan.rideLeaves}</b></span>
        <span><small>📍 on set</small><b>${plan.meet}</b></span>
      </div>
      <${Legs} legs=${legs} commute=${{ ...saved, ...commute }} asking=${asking} problem=${problem} link=${link} />
      <a class="btn btn--primary alarms__set" href=${alarmsLink(project, plan)}
         onClick=${() => changed && save('Alarm settings saved: the robot uses them tonight too.')}>
        ⏰ Set alarm now · ${plan.wake} · ${plan.leaveAlarm}</a>
      ${changed && html`<button class="btn" onClick=${() => save('Alarm settings saved: the robot uses them tonight too.')}>Save without setting</button>`}
    </section>
    <${AlarmFields} values=${values} onChange=${setValues} people=${people} places=${dayPlace?.places || (dayPlace ? [dayPlace] : [])} />
    <${RobotLinkField} link=${link} onChange=${setLink} />`;
}

// where the two legs' minutes come from: Google now, the last answer kept, or the film's own numbers
function Legs({ legs, commute, asking, problem, link }) {
  if (!legs?.drive) {
    return html`<p class="muted">${!link ? 'Paste the robot link below to get the real drive from Google.'
      : asking ? 'Asking Google…' : problem || 'No answer yet.'} Counting the longest drive: ${commute.travel_max ?? 90} min.</p>`;
  }
  const { drive, toMeeting } = legs;
  const how = { walk: 'on foot', transit: 'public transport', fixed: 'your fixed minutes' }[toMeeting.mode] || toMeeting.mode;
  const when = new Date(legs.asked_at).toTimeString().slice(0, 5);
  return html`
    <p class="muted alarms__legs">
      🚇 To the meeting point: <b>${toMeeting.minutes} min</b> ${how}${toMeeting.maps ? ' (Google)' : ''}<br />
      🚗 Drive to ${drive.place ? html`<b>${drive.place.label}</b> ${drive.place.text}` : 'the set'}: <b>${drive.minutes} min</b>${' '}
      ${drive.maps ? `(Google ${drive.google}${drive.rain ? ` + rain ${commute.rain_penalty}` : ''}${Number(commute.drive_margin) ? ` + ${commute.drive_margin} extra` : ''})` : '(no Google answer: the longest drive)'}<br />
      ${asking ? 'Asking Google again…' : problem || `Google asked at ${when}.`}
    </p>`;
}

// the robot link (from the shortcut, with its key): on this phone only
function RobotLinkField({ link, onChange }) {
  const [text, setText] = useState(link);
  const [wrong, setWrong] = useState(false);
  const keep = event => {
    event.preventDefault();
    const ok = setRobotLink(text);
    setWrong(!ok);
    if (ok) onChange(text.trim());
  };
  return html`
    <details class="more" open=${!link}>
      <summary>Robot link ${link ? '✓' : '— needed for Google\'s times'}</summary>
      <form class="item-form" onSubmit=${keep}>
        <label><span>The link your "soundcheck alarms" shortcut opens (…/exec?key=…). Kept on this phone only.</span>
          <input type="text" value=${text} onInput=${e => setText(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec?key=…" /></label>
        ${wrong && html`<p class="muted">That isn't a robot link: it starts with https://script.google.com/macros/s/ and ends with ?key=…</p>`}
        <div class="edit-actions"><button class="btn btn--primary">Keep</button></div>
      </form>
    </details>`;
}
