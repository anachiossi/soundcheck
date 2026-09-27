// proposals.js — accepting or rejecting the changes suggested from production emails.
// Accept: the change is applied to the film (schedule, scene info, characters or a
// preset), exactly like an edit by hand: saved on the device, then uploaded.
// Reject: nothing changes. Either way the decision is written in the proposal file,
// so other devices don't ask again. When every change is decided, the proposal is done.
// Used by: screens/proposal.js

import { getState, saveAndShow, showMessage } from './state.js';
import { applyChange, undecided } from './proposal-rules.js';
import { proposalFile } from './store/repo-files.js';
import { syncNow } from './sync.js';

async function decide(proposalId, changeIds, decision) {
  let film = getState().project;
  const now = new Date().toISOString();
  const outbox = { ...film.outbox };
  const proposal = film.proposals[proposalId];

  if (decision === 'accepted') {
    for (const change of proposal.changes.filter(c => changeIds.includes(c.id))) {
      const result = applyChange(film, change.op);
      film = result.film;
      for (const file of result.files) outbox[file] = { saved_at: now };
    }
  }
  const decisions = { ...proposal.decisions };
  for (const id of changeIds) decisions[id] = decision;
  const updated = { ...proposal, decisions };
  updated.status = undecided(updated).length ? 'open' : 'done';
  outbox[proposalFile(proposalId)] = { saved_at: now };

  await saveAndShow({ ...film, proposals: { ...film.proposals, [proposalId]: updated }, outbox });
  if (updated.status === 'done') showMessage('ok', `${proposal.title}: all done.`);
  syncNow();
}

export const acceptChange = (proposalId, changeId) => decide(proposalId, [changeId], 'accepted');
export const rejectChange = (proposalId, changeId) => decide(proposalId, [changeId], 'rejected');

export function acceptAll(proposalId) {
  const proposal = getState().project.proposals[proposalId];
  return decide(proposalId, undecided(proposal).map(c => c.id), 'accepted');
}
