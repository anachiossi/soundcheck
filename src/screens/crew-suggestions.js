// crew-suggestions.js — on Ana's own devices: the changes the crew suggest from their phones
// (crew-inbox.js lists them at each sync). Looks and works like a 📬 proposal from an email:
// each suggestion in plain words, with ✕ Don't approve (+ an optional reason) or ✓ Approve.
// Also: the banner "Davide suggests 2 changes", one per person, while any wait.
// The data changes in crew-approve.js, never here. Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { setState, showScreen } from '../state.js';
import { suggestionsByPerson, decisionFor } from '../crew-decisions.js';
import { approveSuggestion, dontApprove } from '../crew-approve.js';
import { Icon } from '../parts/icons.js';

const changesWord = count => (count === 1 ? '1 change' : `${count} changes`);
const undecidedOf = (state, suggestions) => suggestions.filter(suggestion => !decisionFor(state, suggestion.issue));

export function CrewSuggestionsBanner({ state }) {
  return suggestionsByPerson(state).map(([by, suggestions]) => {
    const waiting = undecidedOf(state, suggestions).length;
    return waiting > 0 && html`
      <button class="proposal-banner" key=${by} onClick=${() => setState({ screen: 'crew-suggestions', crewBy: by })}>
        <b class="with-icon"><${Icon} name="inbox" /> ${by} suggests ${changesWord(waiting)}</b>
        <span>${waiting} to review ›</span>
      </button>`;
  });
}

export function CrewSuggestionsScreen({ state }) {
  const groups = suggestionsByPerson(state).filter(([by]) => !state.crewBy || by === state.crewBy);
  return html`
    <button class="link back" onClick=${() => showScreen('schedule')}>‹ Back to schedule</button>
    ${groups.length === 0 && html`<p class="empty">Nothing waiting: every suggestion has an answer.</p>`}
    ${groups.map(([by, suggestions]) => html`
      <h2 class="section-title" key=${'title-' + by}>Suggestions from ${by} <small>${undecidedOf(state, suggestions).length} to decide</small></h2>
      <p class="muted" key=${'note-' + by}>Approving changes the film as it is now: your own edits stay.</p>
      <ul class="changes" key=${'list-' + by}>
        ${suggestions.map(suggestion => html`
          <${Suggestion} key=${suggestion.issue} suggestion=${suggestion} decision=${decisionFor(state, suggestion.issue)} />`)}
      </ul>`)}`;
}

function Suggestion({ suggestion, decision }) {
  const [clashes, setClashes] = useState(null); // what changed meanwhile: needs "Approve anyway"
  const [reason, setReason] = useState(null);   // typing why not (null = not asked)
  const [busy, setBusy] = useState(false);
  const lines = suggestion.lines.length ? suggestion.lines : [suggestion.path];

  const approve = async () => {
    setBusy(true);
    const result = await approveSuggestion(suggestion, { anyway: Boolean(clashes) });
    setBusy(false);
    if (result.clashes) setClashes(result.clashes);
  };

  let buttons;
  if (decision) {
    buttons = html`<span class=${'decision decision--' + (decision.decision === 'approved' ? 'accepted' : 'rejected')}>
      ${decision.decision === 'approved' ? '✓ approved' : '✕ not approved'}</span>`;
  } else if (reason !== null) {
    buttons = html`
      <form class="search" onSubmit=${e => { e.preventDefault(); dontApprove(suggestion, reason); setReason(null); }}>
        <input value=${reason} onInput=${e => setReason(e.target.value)} placeholder="Why not? (optional)" aria-label="Reason" autofocus />
        <button class="btn btn--small">✕ Don't approve</button>
      </form>`;
  } else {
    buttons = html`
      <span class="decision-buttons">
        <button class="btn btn--small" onClick=${() => setReason('')}>✕ Don't approve</button>
        <button class="btn btn--small btn--primary" disabled=${busy} onClick=${approve}>${clashes ? '✓ Approve anyway' : '✓ Approve'}</button>
      </span>`;
  }

  return html`
    <li class=${decision ? 'change change--decided' : 'change'}>
      <span class="change__text">
        ${lines.map((line, index) => html`${index > 0 && html`<br />`}${line}`)}
        ${clashes && !decision && html`<br /><span class="warn-text">Changed meanwhile: ${clashes.join('; ')}</span>`}
      </span>
      ${buttons}
    </li>`;
}
