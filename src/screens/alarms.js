// alarms.js — the alarm page (Hours → Alarm settings, or #alarms): the ONE place for a film's alarm rules (Ana, 18 Nov).
// The switch says how the film works: Off · Fixed times · Follow the day's place. Every change is sent to the robot
// (pipeline/gmail-trigger.gs planAnswer), which answers with the times: the app does no alarm sums of its own.
//   • Save → the film's settings.json "commute" (the robot uses them tonight)
//   • on top, the robot's plan as the morning's timeline (parts/alarm-timeline.js)
//   • "Set the 2 alarms" → saves, then runs the "soundcheck alarms" shortcut with the robot's answer
//   • no signal: the last answer kept on the phone, marked; a change can't be counted until there is signal
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { saveSettings } from '../kit-editing.js';
import { showScreen } from '../state.js';
import { AlarmFields, cleanCommute, pageChoices, savedCommute } from '../parts/alarm-fields.js';
import { alarmsLink, askedAt, canSetAlarms, problemText, useRobotPlan } from '../parts/robot-plan.js';
import { AlarmTimeline, setAlarmsLabel } from '../parts/alarm-timeline.js';
import { robotLink, setRobotLink } from '../robot-link.js';

export function AlarmsScreen({ state }) {
  const { project } = state;
  const saved = project.settings?.commute || {};
  const [values, setValues] = useState(() => ({ ...saved }));
  const [link, setLink] = useState(robotLink());
  const commute = cleanCommute(values);
  const { plan, asking, problem, current } = useRobotPlan(project, pageChoices(commute), `${link}|${Boolean(state.sync?.running)}`);
  const newMeetingPoint = (commute.ride_from || '') !== (saved.ride_from || ''); // the robot counts it once saved and synced

  const dayPlace = plan?.date ? project.dayPlaces?.[plan.date] : null;
  const people = plan?.date ? Object.keys(project.crewCalls?.[plan.date] || {}).sort() : [];
  const save = message => saveSettings({ commute: savedCommute(saved, commute) }, message);
  const changed = JSON.stringify(cleanCommute(saved)) !== JSON.stringify(commute);
  const message = 'Alarm settings saved: the robot uses them tonight too.';

  return html`
    <button class="link back" onClick=${() => showScreen('hours')}>‹ Hours</button>
    <section class="tomorrow alarms">
      <${PlanSummary} project=${project} plan=${plan} commute=${commute} link=${link} asking=${asking} problem=${problem} />
      ${plan?.wake && !commute.off && html`
        ${newMeetingPoint ? html`<p class="muted">Save the new meeting point: the robot counts it once it is saved.</p>`
          : canSetAlarms(plan) && (current || !changed)
          ? html`<a class="btn btn--primary alarms__set" href=${alarmsLink(plan)} onClick=${() => changed && save(message)}>
              ${setAlarmsLabel(plan)}</a>`
          : html`<p class="muted">${canSetAlarms(plan) ? 'Waiting for the robot to count your changes.' : 'The alarms can be set in the 24 hours before the wake-up.'}</p>`}`}
      ${changed && html`<button class="btn" onClick=${() => save(message)}>Save</button>`}
    </section>
    <${AlarmFields} values=${values} onChange=${setValues} people=${people} places=${dayPlace?.places || (dayPlace ? [dayPlace] : [])} />
    <${RobotLinkField} link=${link} onChange=${setLink} />`;
}

function PlanSummary({ project, plan, commute, link, asking, problem }) {
  if (commute.off) return html`<p class="muted">Alarms are off for this film: the robot sets none.</p>`;
  if (!link) return html`<p class="muted">Paste the robot link below: the robot counts the times.</p>`;
  if (!plan) return html`<p class="muted">${problemText(problem) || 'Asking the robot…'}</p>`;
  if (plan.none) return html`<p class="muted">No next shooting day with a call time yet.</p>`;
  return html`
    <${AlarmTimeline} project=${project} plan=${plan} />
    <${Legs} plan=${plan} commute=${commute} asking=${asking} problem=${problem} />`;
}

// where the two legs' minutes come from
function Legs({ plan, commute, asking, problem }) {
  const { drive, toMeeting } = plan;
  const how = { walk: 'on foot', transit: 'public transport', fixed: 'your fixed minutes' }[toMeeting.mode] || toMeeting.mode;
  return html`
    <p class="muted alarms__legs">
      🚇 To the meeting point: <b>${toMeeting.minutes} min</b> ${how}${toMeeting.maps ? ' (Google)' : ''}<br />
      🚗 Drive to ${drive.place ? html`<b>${drive.place.label}</b> ${drive.place.text}` : 'the set'}: <b>${drive.minutes} min</b>${' '}
      ${drive.maps ? `(Google ${drive.google}${drive.rain ? ` + rain ${commute.rain_penalty}` : ''}${Number(commute.drive_margin) ? ` + ${commute.drive_margin} extra` : ''})` : '(your fixed minutes)'}<br />
      ${asking ? 'Asking the robot…' : problemText(problem) || `Asked the robot at ${askedAt(plan)}.`}
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
      <summary>Robot link ${link ? '✓' : '(needed for the times)'}</summary>
      <form class="item-form" onSubmit=${keep}>
        <label><span>The link your "soundcheck alarms" shortcut opens (…/exec?key=…). Kept on this phone only.</span>
          <input type="text" value=${text} onInput=${e => setText(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec?key=…" /></label>
        ${wrong && html`<p class="muted">That isn't a robot link: it starts with https://script.google.com/macros/s/ and ends with ?key=…</p>`}
        <div class="edit-actions"><button class="btn btn--primary">Keep</button></div>
      </form>
    </details>`;
}
