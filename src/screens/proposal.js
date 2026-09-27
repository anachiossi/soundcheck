// proposal.js — reviewing a proposal from a production email (e.g. ODG #6):
//   ⚠ warnings  — probably mistakes on the sheet itself: nothing to change
//   changes     — each one: ✓ Accept or ✕ Reject (or "Accept all")
//   ✓ checked   — what was compared and is fine
// Also: the banner that shows up on every screen while a proposal waits.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { setState, showScreen } from '../state.js';
import { formatDate } from '../model.js';
import { openProposals, undecided } from '../proposal-rules.js';
import { acceptChange, rejectChange, acceptAll } from '../proposals.js';

export function ProposalBanner({ project }) {
  return openProposals(project).map(proposal => html`
    <button class="proposal-banner" key=${proposal.id} onClick=${() => setState({ screen: 'proposal', proposalId: proposal.id })}>
      📬 <b>${proposal.title}</b>
      <span>${undecided(proposal).length} to review${proposal.warnings.length ? ` · ⚠ ${proposal.warnings.length}` : ''} ›</span>
    </button>`);
}

export function ProposalScreen({ state }) {
  const proposal = state.project.proposals?.[state.proposalId];
  if (!proposal) return html`<p class="empty">This proposal is gone.</p>`;
  const waiting = undecided(proposal);
  const Decision = ({ change }) => {
    const decision = proposal.decisions?.[change.id];
    if (decision) return html`<span class=${'decision decision--' + decision}>${decision === 'accepted' ? '✓ accepted' : '✕ rejected'}</span>`;
    return html`
      <span class="decision-buttons">
        <button class="btn btn--small" onClick=${() => rejectChange(proposal.id, change.id)}>✕ Reject</button>
        <button class="btn btn--small btn--primary" onClick=${() => acceptChange(proposal.id, change.id)}>✓ Accept</button>
      </span>`;
  };

  return html`
    <button class="link back" onClick=${() => showScreen('schedule')}>‹ Back to schedule</button>
    <h2 class="section-title">${proposal.title}</h2>
    <p class="muted">From the email "${proposal.source.subject}" · ${proposal.kind === 'pdl'
      ? 'the whole schedule, from today on'
      : `Day ${proposal.day}, ${formatDate(proposal.date, { weekday: true })}`}</p>

    ${proposal.warnings.length > 0 && html`
      <div class="proposal-warnings">
        <b>⚠ Possible mistakes on the sheet (nothing to change)</b>
        <ul>${proposal.warnings.map(w => html`<li key=${w}>${w}</li>`)}</ul>
      </div>`}

    <h2 class="section-title">Changes <small>${waiting.length} to decide</small></h2>
    ${proposal.changes.length === 0 && html`<p class="muted">Nothing to change: everything matches.</p>`}
    <ul class="changes">
      ${proposal.changes.map(change => html`
        <li key=${change.id} class=${proposal.decisions?.[change.id] ? 'change change--decided' : 'change'}>
          <span class="change__text">${change.text}</span>
          <${Decision} change=${change} />
        </li>`)}
    </ul>
    ${waiting.length > 1 && html`<button class="btn btn--primary" onClick=${() => acceptAll(proposal.id)}>✓ Accept all ${waiting.length}</button>`}

    <details class="more">
      <summary>✓ Checked and fine (${proposal.checks.length})</summary>
      <ul class="checks">${proposal.checks.map(text => html`<li key=${text}>${text}</li>`)}</ul>
    </details>`;
}
