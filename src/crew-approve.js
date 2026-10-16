// crew-approve.js — Ana approves (or doesn't) a suggestion from the crew (crew-inbox.js lists them).
// Approve: the suggested changes are put into the film as it is NOW on this device (so Ana's own
// later edits of other records are kept), then saved and uploaded like any edit by hand.
// If someone changed the same thing meanwhile, it says so first ("Changed meanwhile: …") and
// needs a second tap ("Approve anyway"). A whole-file suggestion (a file without records) whose
// file changed meanwhile can't be approved at all: it would undo the other changes ("stale").
// Either way the decision waits on this device (crew-decisions.js) until sync.js sends it:
// an approval after its file is uploaded, a "not approved" at the next sync.
// Used by: screens/crew-suggestions.js

import { getState, saveAndShow, showMessage } from './state.js';
import * as github from './store/github.js';
import { applyChanges, describeChanges } from './crew-changes.js';
import { fileContent, setFileContent } from './store/repo-files.js';
import { addDecision } from './crew-decisions.js';
import { syncNow } from './sync.js';
import { connectionFor } from './film-source.js';

// The film with the suggestion put in: { project, clashes: [changes someone else made meanwhile] }.
// base = the film's version the suggestion started from (null when it had none).
export function approvedFilm(project, suggestion, base, now = new Date().toISOString()) {
  const current = fileContent(project, suggestion.path);
  const { content, clashes } = applyChanges(suggestion.path, current, suggestion.changes, base);
  const film = { ...project, outbox: { ...project.outbox, [suggestion.path]: { saved_at: now } } };
  setFileContent(film, suggestion.path, content);
  return { project: film, clashes };
}

// Returns { clashes: ['Gear: Sandbag — quantity changed', …] } when it needs "Approve anyway",
// { stale: true } when the whole file changed meanwhile (only "Don't approve"),
// { done: true } when approved, {} when it couldn't (a message says why).
export async function approveSuggestion(suggestion, { anyway = false } = {}) {
  let base = null;
  if (suggestion.base_sha) {
    try {
      base = await github.readJsonFile(connectionFor(getState().project, getState().connection), suggestion.base_sha);
    } catch (error) {
      showMessage('error', `Couldn't check what changed meanwhile: ${error.message}. Try again with signal.`);
      return {};
    }
  }
  const latest = getState().project; // read after the download: Ana may have saved meanwhile
  const { project, clashes } = approvedFilm(latest, suggestion, base);
  if (clashes.some(change => change.op === 'replace')) return { stale: true };
  if (clashes.length && !anyway) return { clashes: describeChanges(suggestion.path, clashes, latest, base) };
  // the file goes into the outbox FIRST: a decision must never be sent before its file
  await saveAndShow(project);
  addDecision(decisionOf(suggestion, 'approved', ''));
  syncNow();
  return { done: true };
}

// Nothing changes in the film; the reason (optional) goes to the person with the answer.
export function dontApprove(suggestion, reason) {
  addDecision(decisionOf(suggestion, 'not approved', String(reason || '').trim()));
  syncNow();
}

const decisionOf = (suggestion, decision, reason) => ({
  issue: suggestion.issue, decision, reason, by: suggestion.by, path: suggestion.path, film: suggestion.film,
});
