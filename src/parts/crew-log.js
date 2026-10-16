// crew-log.js — Projects → "My suggestions", on a crew phone only: each change this person
// suggested and what happened to it ("Waiting for approval", "Change approved",
// "Change not approved — <reason>", "Closed"), plus their feedback ("Feedback sent").
// A waiting change the film has a newer version of says so under it, in small grey.
// The words come from crew-messages.js. Nothing changes here. Used by: screens/projects.js

import { html } from '../../vendor/preact-htm.js';
import { myMessages } from '../crew-messages.js';

export function MySuggestions({ state }) {
  const messages = myMessages(state.project, state.feedbackWaiting);
  const statusClass = message => (!message.done ? 'decision' : message.approved ? 'decision decision--accepted' : 'decision decision--rejected');
  return html`
    <details class="more"><summary>My suggestions</summary>
      ${messages.length === 0 && html`<p class="empty">Nothing sent yet. The changes you save are sent as suggestions.</p>`}
      <ul class="changes">
        ${messages.map(message => html`
          <li key=${message.key} class=${message.done ? 'change change--decided' : 'change'}>
            <span class="change__text">${message.lines.map((line, index) => html`${index > 0 && html`<br />`}${line}`)}
              ${message.note && html`<br /><small class="muted">${message.note}</small>`}</span>
            <span class=${statusClass(message)}>${message.status}</span>
          </li>`)}
      </ul>
    </details>`;
}
