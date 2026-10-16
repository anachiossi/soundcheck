// my-call-switch.js — "My call" in Projects: General crew call · Personal call (my-call.js).
// Personal: the person types their name as printed on the call sheet; their hours, the ⏱ wrap clock,
// the timesheet and the wake plan then count from their own call. Kept on this device only.
// The same look as "Screen: Auto · Light · Dark" (parts/theme-switch.js).
// Used by: screens/projects.js

import { html, useState } from '../../vendor/preact-htm.js';
import { rememberMyCall, showMessage } from '../state.js';
import { isCrew } from '../crew-link.js';
import { GENERAL_CALL } from '../my-call.js';

const CHOICES = [['general', 'General crew call'], ['personal', 'Personal call']];

export function MyCallSwitch({ state }) {
  const setting = state.myCall || GENERAL_CALL;
  // a crew phone starts with the name in its link
  const [name, setName] = useState(setting.name || (isCrew(state.connection) ? state.connection.name : ''));
  const choose = mode => rememberMyCall({ mode, name: setting.name || name.trim() });
  const save = event => {
    event.preventDefault();
    rememberMyCall({ mode: 'personal', name: name.trim() });
    showMessage('ok', `My call: the call of ${name.trim()} on the call sheet.`);
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
