// my-call-switch.js — "My call" in Projects: General crew call · Personal call (my-call.js).
// Personal: the person types their name as printed on the call sheet; their hours, the ⏱ wrap clock,
// the timesheet and the wake plan then count from their own call. Kept on this device; on Ana's own
// devices also saved for the robots' alarms and notifications (settings.json commute "my_name").
// The same look as "Screen: Auto · Light · Dark" (parts/theme-switch.js).
// Used by: screens/projects.js

import { html, useState } from '../../vendor/preact-htm.js';
import { rememberMyCall, showMessage } from '../state.js';
import { isCrew } from '../crew-link.js';
import { GENERAL_CALL } from '../my-call.js';
import { followMyCall } from '../hours-editing.js';

const CHOICES = [['general', 'General crew call'], ['personal', 'Personal call']];

export function MyCallSwitch({ state }) {
  const setting = state.myCall || GENERAL_CALL;
  // a crew phone starts with the name in its link
  const [name, setName] = useState(setting.name || (isCrew(state.connection) ? state.connection.name : ''));
  // on Ana's own devices the robots follow it too (followMyCall; never on a crew phone)
  const choose = mode => {
    const chosen = { mode, name: setting.name || name.trim() };
    rememberMyCall(chosen);
    followMyCall(chosen);
  };
  const save = event => {
    event.preventDefault();
    const chosen = { mode: 'personal', name: name.trim() };
    rememberMyCall(chosen);
    showMessage('ok', `My call: the call of ${chosen.name} on the call sheet.`);
    followMyCall(chosen);
  };
  return html`
    <h2 class="section-title">My call</h2>
    <div class="segmented">
      ${CHOICES.map(([value, label]) => html`
        <button key=${value} class=${setting.mode === value ? 'on' : ''} onClick=${() => choose(value)}>${label}</button>`)}
    </div>
    ${setting.mode === 'personal' && html`
      <form class="form" onSubmit=${save}>
        <label>Your name as printed on the call sheet
          <input required value=${name} onInput=${event => setName(event.target.value)} placeholder="e.g. Maria Rossi" /></label>
        <button class="btn btn--primary" disabled=${!name.trim() || name.trim() === setting.name}>Save</button>
      </form>`}
    <p class="muted">Your hours count from it. The Schedule always shows the crew call.</p>`;
}
