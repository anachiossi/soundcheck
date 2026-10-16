// crew-decisions.js — Ana's decisions on crew suggestions that are not sent yet, kept on THIS
// device only (not in the film data), so they survive a reload and wait while there's no signal:
//   state.crewDecisions = [{ issue, decision: 'approved' | 'not approved', reason, by, path, film }]
// saved in localStorage as 'sc_crew_decisions' (state.js reads it back at start).
// sync.js sends them (crew-inbox.js) and forgets them.
// Also the list of open suggestions shown in the inbox (state.crewSuggestions, filled by sync.js).
// Used by: crew-approve.js, sync.js, screens/crew-suggestions.js

import { getState, setState } from './state.js';

const KEY = 'sc_crew_decisions';

export function rememberDecisions(crewDecisions) {
  try { localStorage.setItem(KEY, JSON.stringify(crewDecisions)); } catch { /* not remembered after a reload */ }
  setState({ crewDecisions });
}

export function addDecision(decision) {
  const others = getState().crewDecisions.filter(item => item.issue !== decision.issue);
  rememberDecisions([...others, decision]);
}

// Sent (or gone): no longer waiting.
export function forgetDecisions(issues) {
  if (!issues.length) return;
  rememberDecisions(getState().crewDecisions.filter(item => !issues.includes(item.issue)));
}

// The decision taken on one suggestion (or undefined: still to decide).
export const decisionFor = (state, issue) => state.crewDecisions.find(item => item.issue === issue);

// The open suggestions of the open film, grouped by person: [[name, [suggestions]], …]
export function suggestionsByPerson(state) {
  const groups = new Map();
  for (const suggestion of state.crewSuggestions) {
    if (suggestion.film !== state.project?.folder) continue;
    if (!groups.has(suggestion.by)) groups.set(suggestion.by, []);
    groups.get(suggestion.by).push(suggestion);
  }
  return [...groups.entries()];
}
