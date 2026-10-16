// crew-inbox-sync.js — on Ana's own devices: the crew part of each sync, and "Mark as read".
//   1. Ana's decisions go out once their file is uploaded (crew-inbox.js sendDecisions); when her
//      key can't answer issues they wait, and state.crewCantAnswer shows one line on the screen
//   2. the crew's open suggestions and feedback are listed for the 📬 banners
//      (state.crewSuggestions, state.crewFeedback), without the names Ana removed.
// Never stops the sync: with no signal (GitHub busy…) everything waits for the next one.
// Used by: sync.js (owner devices only), screens/crew-suggestions.js (Mark as read)

import { getState, setState, showMessage } from './state.js';
import * as inbox from './crew-inbox.js';
import { forgetDecisions } from './crew-decisions.js';

export async function ownerInbox(connection, store) {
  try {
    const project = store.read();
    const { done, cantAnswer } = await inbox.sendDecisions(connection, project, getState().crewDecisions);
    forgetDecisions(done);
    // the key can't answer: the decisions wait, and one quiet line says why (no message each sync)
    if (cantAnswer !== undefined) setState({ crewCantAnswer: cantAnswer });
    const { suggestions, feedback } = await inbox.loadInbox(connection, project.folder, getState().crewRemoved);
    setState({ crewSuggestions: suggestions, crewFeedback: feedback });
  } catch { /* the next sync tries again */ }
}

// Feedback read: closed on GitHub with "thanks", and off the list. Needs signal.
export async function markFeedbackRead(feedback) {
  try {
    await inbox.closeFeedback(getState().connection, feedback.issue);
  } catch (error) {
    if (error.status !== 404 && error.status !== 410) {
      showMessage('error', `Couldn't mark it as read: ${error.message}. Try again with signal.`);
      return;
    }
  }
  setState({ crewFeedback: getState().crewFeedback.filter(item => item.issue !== feedback.issue) });
}
