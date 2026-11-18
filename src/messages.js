// messages.js — how many things wait for an answer: production emails, the crew's suggestions and feedback,
// and requests from the kit website. The number on the Messages button in the top bar.
// Used by: parts/top-menu.js

import { crewHides, isCrew } from './crew-link.js';
import { openProposals } from './proposal-rules.js';
import { suggestionsByPerson, decisionFor, feedbackToRead } from './crew-decisions.js';
import { requestsByPerson } from './kit-requests.js';

export function messagesWaiting(state) {
  const { project, connection } = state;
  if (!project) return 0;
  const emails = crewHides(connection, 'email-proposals') ? 0 : openProposals(project).length;
  const suggestions = suggestionsByPerson(state).flatMap(([, list]) => list).filter(item => !decisionFor(state, item.issue)).length;
  const kit = isCrew(connection) ? 0 : requestsByPerson(state.kitRequests).flatMap(([, list]) => list).length;
  return emails + suggestions + feedbackToRead(state).length + kit;
}
