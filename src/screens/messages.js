// messages.js — the Messages screen: everything waiting for an answer in one list (Ana, 18 Nov: one button
// instead of three banners on every screen): production emails, the crew's suggestions, the kit website's requests.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { crewHides, isCrew } from '../crew-link.js';
import { messagesWaiting } from '../messages.js';
import { ProposalBanner } from './proposal.js';
import { CrewSuggestionsBanner } from './crew-suggestions.js';
import { KitRequestsBanner } from './kit-requests.js';

export function MessagesScreen({ state }) {
  const { project, connection } = state;
  return html`
    <h2 class="section-title">Messages</h2>
    ${messagesWaiting(state) === 0 && html`<p class="empty">Nothing waiting.</p>`}
    ${!crewHides(connection, 'email-proposals') && html`<${ProposalBanner} project=${project} />`}
    <${CrewSuggestionsBanner} state=${state} />
    ${!isCrew(connection) && html`<${KitRequestsBanner} state=${state} />`}`;
}
