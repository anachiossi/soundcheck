// alarm-fields.js — the fields of the alarm page (screens/alarms.js): who you ride with, the meeting point and how you
// get there, which place of the ODG the car goes to, and your minutes (Ana, 5–6 Nov). Every change shows at once in
// the times above; nothing is saved until "Save" or "Set alarm now".
//   values  the page's draft of the film's settings.json "commute" (ride_with, ride_from, to_meeting, walk_to_ride,
//           drive_to, meet_before_call, drive_margin, get_ready, sleep_hours, leave_alarm_before)
// Used by: screens/alarms.js

import { html } from '../../vendor/preact-htm.js';

const TO_MEETING = [['auto', 'Auto (on foot under 1 km)'], ['walk', 'On foot'], ['transit', 'Public transport'], ['', 'Fixed minutes']];

const NUMBERS = [
  ['meet_before_call', 'On set before the call (min)'],
  ['drive_margin', 'Extra on Google\'s drive (min)'],
  ['get_ready', 'From waking up to leaving (min)'],
  ['leave_alarm_before', 'Leave alarm, before walking out (min)'],
  ['sleep_hours', 'Hours of sleep'],
];

// people: the names on that day's call sheet (calls.json), else the crew list; places: the ODG's places that day
export function AlarmFields({ values, onChange, people, places }) {
  const set = (key, value) => onChange({ ...values, [key]: value });
  return html`
    <div class="item-form alarm-fields">
      <label><span>Riding with (their call decides the times)</span>
        <select value=${values.ride_with || ''} onChange=${e => set('ride_with', e.target.value)}>
          <option value="">Nobody — my own call</option>
          ${people.map(name => html`<option key=${name} value=${name}>${name}</option>`)}
          ${values.ride_with && !people.includes(values.ride_with) && html`<option value=${values.ride_with}>${values.ride_with}</option>`}
        </select></label>

      <label><span>Meeting point (a public place: a station, a square…)</span>
        <input type="text" value=${values.ride_from || ''} placeholder="the ride's house — kept private in the robot"
               onInput=${e => set('ride_from', e.target.value)} /></label>

      <span class="alarm-fields__title">From home to the meeting point</span>
      <div class="chips">
        ${TO_MEETING.map(([id, label]) => html`<button key=${id} type="button" class=${'chip' + ((values.to_meeting || '') === id ? ' chip--on' : '')}
          onClick=${() => set('to_meeting', id)}>${label}</button>`)}
      </div>
      ${!values.to_meeting && html`<label><span>Minutes to the meeting point</span>
        <input type="number" min="0" step="5" value=${values.walk_to_ride ?? 0} onInput=${e => set('walk_to_ride', e.target.value)} /></label>`}

      <span class="alarm-fields__title">The car goes to (from the ODG)</span>
      ${places.length ? html`<div class="chips">
        ${places.map(place => html`<button key=${place.kind} type="button" class=${'chip alarm-fields__place' + (values.drive_to === place.kind ? ' chip--on' : '')}
          onClick=${() => set('drive_to', place.kind)}><b>${place.label}</b> ${place.text}</button>`)}
      </div>` : html`<p class="muted">No places read from this day's ODG yet: the longest drive is counted.</p>`}

      ${NUMBERS.map(([key, label]) => html`<label key=${key}><span>${label}</span>
        <input type="number" min="0" step=${key === 'sleep_hours' ? '0.5' : '5'} value=${values[key] ?? ''}
               onInput=${e => set(key, e.target.value)} /></label>`)}
    </div>`;
}

// the draft as numbers, ready for settings.json (empty → left out, so the film's own value stays)
export function cleanCommute(values) {
  const clean = { ...values };
  for (const [key] of NUMBERS) {
    if (clean[key] === '' || clean[key] === undefined) delete clean[key];
    else clean[key] = Math.max(0, Number(clean[key]) || 0);
  }
  clean.walk_to_ride = Math.max(0, Number(clean.walk_to_ride) || 0);
  for (const key of ['ride_with', 'ride_from', 'to_meeting', 'drive_to']) {
    clean[key] = String(clean[key] || '').trim();
    if (!clean[key]) delete clean[key];
  }
  return clean;
}

// the film's commute after saving the page: its other keys kept (my_name, days, rain_penalty…), the page's keys as the
// page says — one emptied on the page (e.g. "Fixed minutes" → no to_meeting) is taken out; a chosen ODG place turns
// on Google Maps for the drive ("travel": "maps")
const PAGE_KEYS = ['ride_with', 'ride_from', 'to_meeting', 'walk_to_ride', 'drive_to', ...NUMBERS.map(([key]) => key)];
export function savedCommute(current, page) {
  const commute = { ...current };
  for (const key of PAGE_KEYS) {
    if (page[key] === undefined) delete commute[key];
    else commute[key] = page[key];
  }
  if (commute.drive_to) commute.travel = 'maps';
  return commute;
}
