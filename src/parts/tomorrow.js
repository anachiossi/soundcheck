// tomorrow.js — the night before the next shooting day (hours-rules.js wakePlan): when to sleep, wake
// up, leave home and be at the meeting point, from the ODG's call. ⏰ Set alarms hands the wake-up and
// leave times to an iPhone shortcut ("soundcheck alarms"), which first removes its old alarms (label
// "soundcheck · …") and then creates the two new ones in Clock — never piling up (Ana) —
// a web app can't set alarms itself. The robot's push "Tomorrow D10 · call 10:00" opens the app here.
// While the app syncs the button waits: a new ODG may come. The times use the newest ODG even before it
// is reviewed (hours-rules.js nextShootingDay); an ODG waiting for review is shown above — tap it to review.
// Also: the five numbers of the film (settings.json → "commute"), editable.
// Used by: screens/hours.js

import { html, useState } from '../../vendor/preact-htm.js';
import { formatDate } from '../model.js';
import { COMMUTE, commuteOf, wakePlan, nextShootingDay } from '../hours-rules.js';
import { saveSettings } from '../kit-editing.js';
import { getState, setState } from '../state.js';
import { undecided } from '../proposal-rules.js';

export const SHORTCUT = 'soundcheck alarms';

// shortcuts://run-shortcut?name=soundcheck%20alarms&input=text&text=06:00;06:45 — just the two times, so
// the shortcut takes the First Item (wake) and the Last Item (leave): no index to type (Ana, iOS 27)
export const alarmsLink = (project, plan) => `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT)}&input=text&text=${
  encodeURIComponent(`${plan.wake};${plan.leaveFrom}`)}`;

export function Tomorrow({ project }) {
  const day = nextShootingDay(project);
  const plan = day && wakePlan(project, day);
  const waiting = Object.values(project.proposals || {}).filter(p => p.id.startsWith('odg-') && p.status === 'open' && undecided(p).length);
  if (!commuteOf(project)) return html`<${CommuteSettings} project=${project} />`;
  return html`
    <section class="tomorrow">
      ${plan ? html`
        <p class="tomorrow__day"><b>Next: D${plan.day}</b> · ${formatDate(plan.date, { weekday: true })} · call <b>${plan.call}</b></p>
        <div class="tomorrow__times">
          <span><small>💤 sleep</small><b>${plan.sleep}</b></span>
          <span><small>⏰ wake</small><b>${plan.wake}</b></span>
          <span><small>🚪 leave</small><b>${plan.leaveFrom}</b><small>to ${plan.leaveTo}</small></span>
          <span><small>📍 meet</small><b>${plan.meet}</b></span>
        </div>
        ${waiting.map(p => html`<button key=${p.id} class="btn tomorrow__odg" onClick=${() => setState({ screen: 'proposal', proposalId: p.id })}>
          📬 ${p.title} waits for your review — the alarms already use its call</button>`)}
        ${getState().sync?.running
          ? html`<span class="btn" aria-disabled="true">⏳ Checking for a new ODG…</span>`
          : html`<a class="btn btn--primary" href=${alarmsLink(project, plan)}>⏰ Set alarms ${plan.wake} · ${plan.leaveFrom}</a>`}`
      : html`<p class="muted">No next shooting day with a call time yet.</p>`}
      <${CommuteSettings} project=${project} />
    </section>`;
}

const FIELDS = [
  ['meet_before_call', 'Meeting point, minutes before the call'],
  ['travel_min', 'Travel to the meeting point, shortest (min)'],
  ['travel_max', 'Travel to the meeting point, longest (min)'],
  ['get_ready', 'From waking up to leaving (min)'],
  ['sleep_hours', 'Hours of sleep'],
];

function CommuteSettings({ project }) {
  const current = commuteOf(project);
  const [values, setValues] = useState(current || COMMUTE);
  const save = event => {
    event.preventDefault();
    const clean = Object.fromEntries(FIELDS.map(([key]) => [key, Math.max(0, Number(values[key]) || 0)]));
    saveSettings({ commute: clean }, 'Wake-up plan saved.');
  };
  return html`
    <details class="more tomorrow__settings" open=${!current}>
      <summary>${current ? 'Wake-up plan for this film' : 'Wake-up plan (sleep · wake · leave · meet) — set it up'}</summary>
      <form class="item-form" onSubmit=${save}>
        ${FIELDS.map(([key, label]) => html`
          <label key=${key}><span>${label}</span>
            <input type="number" min="0" step=${key === 'sleep_hours' ? '0.5' : '5'} value=${values[key]}
                   onInput=${e => setValues(v => ({ ...v, [key]: e.target.value }))} /></label>`)}
        <div class="edit-actions"><button class="btn btn--primary">Save</button></div>
      </form>
      <p class="muted">The alarms need a shortcut on the iPhone, once: see Help → Alarms.</p>
    </details>`;
}
