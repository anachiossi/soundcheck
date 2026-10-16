// crew-messages.js — "My suggestions" on a crew phone (Projects): what this person sent and what
// happened to it, in neutral words (they never say who decided):
//   Waiting for approval · Change approved · Change not approved — <reason> · Closed
//   Feedback sent · Feedback waiting to send (no signal yet)
// First what is still waiting, then the answers, newest first.
// Reads the film's crewSuggestions (crew-sync.js) and the feedback kept on the phone (crew-device.js).
// Only words here, no screens. Used by: parts/crew-log.js

import { feedbackLines } from './crew-feedback.js';

export const STATUS = {
  waiting: 'Waiting for approval',
  approved: 'Change approved',
  notApproved: 'Change not approved',
  closed: 'Closed',
  feedbackSent: 'Feedback sent',
  feedbackWaiting: 'Feedback waiting to send',
};

function statusOf(entry) {
  if (entry.state === 'approved') return STATUS.approved;
  if (entry.state === 'not approved') return entry.reason ? `${STATUS.notApproved} — ${entry.reason}` : STATUS.notApproved;
  if (entry.state === 'feedback sent') return STATUS.feedbackSent;
  return STATUS.closed;
}

const newestFirst = (a, b) => String(b.at || '').localeCompare(String(a.at || ''));

// → [{ key, lines: ['Gear: + Sandbag'], status: 'Change approved', done: true | false, approved: true | false }]
export function myMessages(project, feedbackWaiting = []) {
  const book = project?.crewSuggestions || {};
  const waiting = [
    ...feedbackWaiting.filter(feedback => feedback.film === project?.folder).map(feedback => ({
      key: `feedback-${feedback.at}`, lines: feedbackLines(feedback), status: STATUS.feedbackWaiting, at: feedback.at })),
    ...Object.entries(book.sent || {}).map(([path, sent]) => ({
      key: `sent-${sent.issue}`, lines: sent.lines?.length ? sent.lines : [path], status: STATUS.waiting, at: sent.saved_at })),
  ].sort(newestFirst);
  const answered = (book.log || []).map(entry => ({
    key: `log-${entry.issue}-${entry.at}`, lines: entry.lines?.length ? entry.lines : [entry.path || ''],
    status: statusOf(entry), at: entry.at, approved: entry.state === 'approved' || entry.state === 'feedback sent',
  })).sort(newestFirst);
  return [
    ...waiting.map(({ at, ...message }) => ({ ...message, done: false, approved: false })),
    ...answered.map(({ at, ...message }) => ({ ...message, done: true })),
  ];
}
