// alarm-fields.js — the fields of the alarm page (screens/alarms.js): the switch (Off · Fixed times · Follow the day's
// place, Ana 18 Nov), who you ride with, how you get there, and your minutes. Every change goes to the robot, which
// answers with the times; nothing is saved until "Save" or "Set alarm now".
//   values  the page's draft of the film's settings.json "commute"
// Used by: screens/alarms.js

import { html } from '../../vendor/preact-htm.js';

const MODES = [['off', 'Off'], ['fixed', 'Fixed times'], ['place', 'Follow the day\'s place']];
const TO_MEETING = [['auto', 'Auto (on foot under 1 km)'], ['walk', 'On foot'], ['transit', 'Public transport'], ['', 'Fixed minutes']];

const BOTH = [
  ['meet_before_call', 'On set before the call (min)'],
  ['get_ready', 'From waking up to leaving (min)'],
  ['leave_alarm_before', 'Leave alarm, before walking out (min)'],
  ['sleep_hours', 'Hours of sleep'],
];
const FIXED = [['walk_to_ride', 'Minutes to the meeting point'], ['travel_max', 'Drive (min)']];
const PLACE = [['drive_margin', 'Extra on Google\'s drive (min)'], ['rain_penalty', 'Extra when the ODG says rain (min)']];
const NUMBERS = [...BOTH, ...FIXED, ...PLACE];
const WORDS = ['ride_with', 'ride_from', 'to_meeting', 'drive_to', 'travel'];

export const modeOf = values => (values.off ? 'off' : values.travel === 'maps' ? 'place' : 'fixed');

function withMode(values, mode) {
  if (mode === 'off') return { ...values, off: true };
  if (mode === 'place') return { ...values, off: false, travel: 'maps' };
  return { ...values, off: false, travel: 'fixed', to_meeting: '', drive_to: '', drive_margin: '' };
}

// people: the names on that day's call sheet (calls.json); places: the ODG's places that day
export function AlarmFields({ values, onChange, people, places }) {
  const set = (key, value) => onChange({ ...values, [key]: value });
  const mode = modeOf(values);
  const number = ([key, label]) => html`<label key=${key}><span>${label}</span>
    <input type="number" min="0" step=${key === 'sleep_hours' ? '0.5' : '5'} value=${values[key] ?? ''}
           onInput=${e => set(key, e.target.value)} /></label>`;
  return html`
    <div class="item-form alarm-fields">
      <span class="alarm-fields__title">Alarms for this film</span>
      <div class="chips">
        ${MODES.map(([id, label]) => html`<button key=${id} type="button" class=${'chip' + (mode === id ? ' chip--on' : '')}
          onClick=${() => onChange(withMode(values, id))}>${label}</button>`)}
      </div>
      ${mode !== 'off' && html`
        <label><span>Riding with (their call decides the times)</span>
          <select value=${values.ride_with || ''} onChange=${e => set('ride_with', e.target.value)}>
            <option value="">Nobody, my own call</option>
            ${people.map(name => html`<option key=${name} value=${name}>${name}</option>`)}
            ${values.ride_with && !people.includes(values.ride_with) && html`<option value=${values.ride_with}>${values.ride_with}</option>`}
          </select></label>
        ${mode === 'fixed' && FIXED.map(number)}
        ${mode === 'place' && html`
          <label><span>Meeting point (a public place: a station, a square…)</span>
            <input type="text" value=${values.ride_from || ''} placeholder="the ride's house, kept private in the robot"
                   onInput=${e => set('ride_from', e.target.value)} /></label>
          <span class="alarm-fields__title">From home to the meeting point</span>
          <div class="chips">
            ${TO_MEETING.map(([id, label]) => html`<button key=${id} type="button" class=${'chip' + ((values.to_meeting || '') === id ? ' chip--on' : '')}
              onClick=${() => set('to_meeting', id)}>${label}</button>`)}
          </div>
          ${!values.to_meeting && number(FIXED[0])}
          <span class="alarm-fields__title">The car goes to (from the ODG)</span>
          ${places.length ? html`<div class="chips">
            ${places.map(place => html`<button key=${place.kind} type="button" class=${'chip alarm-fields__place' + (values.drive_to === place.kind ? ' chip--on' : '')}
              onClick=${() => set('drive_to', place.kind)}><b>${place.label}</b> ${place.text}</button>`)}
          </div>` : html`<p class="muted">No places read from this day's ODG yet.</p>`}
          ${PLACE.map(number)}`}
        ${BOTH.map(number)}`}
    </div>`;
}

// the draft as numbers, ready for settings.json (empty → left out, so the film's own value stays)
export function cleanCommute(values) {
  const clean = { ...values };
  for (const [key] of NUMBERS) {
    if (clean[key] === '' || clean[key] === undefined) delete clean[key];
    else clean[key] = Math.max(0, Number(clean[key]) || 0);
  }
  for (const key of WORDS) {
    clean[key] = String(clean[key] || '').trim();
    if (!clean[key]) delete clean[key];
  }
  if (!clean.off) delete clean.off;
  return clean;
}

// the question for the robot: every choice of the page, an emptied one too (it must win over the saved value)
export function pageChoices(commute) {
  const choices = { off: commute.off ? 'yes' : 'no' };
  for (const key of WORDS) if (key !== 'ride_from') choices[key] = commute[key] ?? ''; // the robot counts only a saved meeting point
  for (const [key] of NUMBERS) if (commute[key] !== undefined) choices[key] = commute[key];
  return choices;
}

// the film's commute after saving the page: its other keys kept (my_name, days…), the page's keys as the page says
const PAGE_KEYS = ['off', ...WORDS, ...NUMBERS.map(([key]) => key)];
export function savedCommute(current, page) {
  const commute = { ...current };
  for (const key of PAGE_KEYS) {
    if (page[key] === undefined) delete commute[key];
    else commute[key] = page[key];
  }
  return commute;
}
