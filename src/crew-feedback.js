// crew-feedback.js — "Enjoyed soundcheck? Share some feedback", from a crew phone.
// The form (parts/crew-feedback-form.js) keeps the feedback on the phone first (crew-device.js), so it
// works with no signal. The next sync sends it as a GitHub issue "Feedback from Davide": readable
// lines, then the details as JSON with the marker { soundcheck: 'crew-feedback', version: 1 } (the
// label 'crew-feedback' is added but not trusted: it may not exist). Once sent it shows in
// "My suggestions" as "Feedback sent". Ana's devices read it back (crew-inbox.js).
// Also: when to offer it by itself, once — the film's last shooting day is 3 days away or less
// (and up to a week after it, while the crew key still works).
// Used by: sync.js (crew phones), crew-inbox.js, parts/crew-feedback-form.js, screens/crew-suggestions.js

import * as github from './store/github.js';
import { shootingDays, localTodayIso } from './model.js';
import { getState } from './state.js';
import { rememberWaitingFeedback } from './crew-device.js';
import { crewBook } from './crew-sync.js';

export const FEEDBACK_MARKER = 'crew-feedback';
export const FEEDBACK_LABEL = 'crew-feedback';
const OFFER_DAYS_BEFORE = 3;
const OFFER_DAYS_AFTER = 7; // the crew key ends a week after the last shooting day
const DAY = 24 * 3600 * 1000;

export const starsText = stars => '★'.repeat(stars) + '☆'.repeat(5 - stars);

// The lines people read: in the issue, in "My suggestions", in Ana's Feedback list.
export function feedbackLines(feedback) {
  const lines = [];
  if (feedback.stars) lines.push(`${starsText(feedback.stars)} (${feedback.stars} of 5)`);
  if (feedback.helped) lines.push(`What helped: ${feedback.helped}`);
  if (feedback.annoyed) lines.push(`What annoyed: ${feedback.annoyed}`);
  if (feedback.text) lines.push(feedback.text);
  return lines;
}

// feedback = { film, by, stars (0 = none chosen, 1–5), helped, annoyed, text, at } → { title, body, labels }
export function feedbackIssue(feedback) {
  const { film, by, stars, helped, annoyed, text, at } = feedback;
  const data = { soundcheck: FEEDBACK_MARKER, version: 1, film, by, stars, helped, annoyed, text, at };
  // three backticks typed by the person would look like the start of the details: made harmless
  const readable = feedbackLines(feedback).map(line => line.replace(/`{3,}/g, "'''"));
  const body = [...readable, '', '```json', JSON.stringify(data, null, 2), '```', ''].join('\n');
  return { title: `Feedback from ${by}`, body, labels: [FEEDBACK_LABEL] };
}

// A GitHub issue → { issue, state, film, by, stars, helped, annoyed, text, at, lines },
// or null when it isn't soundcheck feedback.
export function readFeedback(issue) {
  const match = /```json\s*\n([\s\S]*?)\n\s*```/.exec(String(issue?.body || ''));
  if (!match) return null;
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!data || data.soundcheck !== FEEDBACK_MARKER || data.version !== 1 || typeof data.by !== 'string') return null;
  const words = field => (typeof data[field] === 'string' ? data[field] : '');
  const stars = Number.isInteger(data.stars) && data.stars >= 0 && data.stars <= 5 ? data.stars : 0;
  const feedback = { issue: issue.number, state: issue.state, film: data.film, by: data.by, stars,
    helped: words('helped'), annoyed: words('annoyed'), text: words('text'), at: words('at') };
  return { ...feedback, lines: feedbackLines(feedback) };
}

// Days from one 'YYYY-MM-DD' to another, counted on the calendar (no time zones involved).
export function daysBetween(fromIso, toIso) {
  const dayNumber = iso => {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / DAY;
  };
  return dayNumber(toIso) - dayNumber(fromIso);
}

// The film's last shooting day, 'YYYY-MM-DD' (null when the schedule has no dates).
export function lastShootingDate(project) {
  const dates = shootingDays(project).map(day => day.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

// Offer the feedback by itself now? Once per film: offered = the films already offered.
export function feedbackDue(project, offered, now = new Date()) {
  if (!project || offered.includes(project.folder)) return false;
  const last = lastShootingDate(project);
  if (!last) return false;
  const left = daysBetween(localTodayIso(now), last);
  return left <= OFFER_DAYS_BEFORE && left >= -OFFER_DAYS_AFTER;
}

// At a crew sync: the feedback waiting on this phone for this film → issues, then a line in the log.
// Never breaks the sync: with no signal (or any error) it waits for the next one.
// Returns how many were sent.
export async function sendWaitingFeedback(connection, store) {
  let sent = 0;
  try {
    for (const feedback of getState().feedbackWaiting) {
      if (feedback.film !== store.read().folder) continue;
      const issue = await github.createIssue(connection, feedbackIssue(feedback));
      rememberWaitingFeedback(getState().feedbackWaiting.filter(item => item !== feedback));
      const project = store.read();
      const book = crewBook(project);
      book.log.push({ issue: issue.number, kind: 'feedback', lines: feedbackLines(feedback), state: 'feedback sent',
        reason: '', at: new Date().toISOString() });
      await store.save({ ...project, crewSuggestions: book });
      sent++;
    }
  } catch { /* the rest waits on the phone for the next sync */ }
  return sent;
}
