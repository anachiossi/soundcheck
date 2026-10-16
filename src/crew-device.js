// crew-device.js — the crew lists kept on THIS device only (localStorage), never in the film data.
// Ana's devices (Projects → Share with crew):
//   'sc_crew_key'     the film's crew key            → state.crewKey
//   'sc_crew_names'   names crew links were made for → state.crewNames
//   'sc_crew_removed' names Ana removed: their suggestions and feedback are ignored (crew-inbox.js)
//                                                    → state.crewRemoved
// A crew phone:
//   'sc_crew_feedback'    feedback written but not sent yet (sent at the next sync, crew-feedback.js)
//                                                    → state.feedbackWaiting
//   'sc_feedback_offered' films whose "The film is wrapping…" line was already offered
//                                                    → state.feedbackOffered
// state.js reads them back at start. Used by: parts/crew-share.js, parts/crew-feedback-form.js,
// crew-feedback.js

import { getState, setState } from './state.js';

function keep(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not remembered after a reload */ }
}

// ---- Ana's devices ----------------------------------------------------------------

export function rememberCrewKey(crewKey) {
  keep('sc_crew_key', crewKey);
  setState({ crewKey });
}

export function rememberCrewName(name) {
  const { crewNames } = getState();
  if (crewNames.includes(name)) return;
  keep('sc_crew_names', [...crewNames, name]);
  setState({ crewNames: [...crewNames, name] });
}

// Soft remove: the person's link still opens the film, but nothing they send is shown.
export function removeCrewName(name) {
  const crewRemoved = [...getState().crewRemoved.filter(item => item !== name), name];
  keep('sc_crew_removed', crewRemoved);
  setState({ crewRemoved });
}

export function restoreCrewName(name) {
  const plain = text => String(text || '').trim().toLowerCase();
  const crewRemoved = getState().crewRemoved.filter(item => plain(item) !== plain(name));
  keep('sc_crew_removed', crewRemoved);
  setState({ crewRemoved });
}

// ---- a crew phone ----------------------------------------------------------------

// feedback = { film, by, stars, helped, annoyed, text, at }
export function queueFeedback(feedback) {
  rememberWaitingFeedback([...getState().feedbackWaiting, feedback]);
}

export function rememberWaitingFeedback(feedbackWaiting) {
  keep('sc_crew_feedback', feedbackWaiting);
  setState({ feedbackWaiting });
}

export function markFeedbackOffered(folder) {
  const { feedbackOffered } = getState();
  if (feedbackOffered.includes(folder)) return;
  keep('sc_feedback_offered', [...feedbackOffered, folder]);
  setState({ feedbackOffered: [...feedbackOffered, folder] });
}
