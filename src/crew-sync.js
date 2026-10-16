// crew-sync.js — syncing on a crew phone (crew-link.js). A crew phone never writes the film:
// each file changed on the phone (the outbox) is sent as a SUGGESTION, a GitHub issue that says
// what changed (crew-changes.js). The phone keeps its changed file, marked "proposed".
// When the suggestion is closed (approved or not), the phone drops its version and downloads
// the film's version again (which has the change if it was approved).
// Used by: sync.js (which also downloads the film as usual), main.js (the "proposed" badge).
//
// The bookkeeping lives in the film on this phone:
//   project.crewSuggestions = {
//     base: { path: sha }                   the film's version each change started from
//     sent: { path: { issue, saved_at, lines } }   the open suggestion of each file (issue number)
//     log:  [{ issue, path, lines, state, reason, at }]   what happened to each suggestion
//   }   state: 'approved' | 'not approved' | 'closed' | 'feedback sent' (kind: 'feedback', crew-feedback.js)
// "My suggestions" in Projects shows them (crew-messages.js).
// (`project.crew` is already the IFB crew list, hence the longer name.)
// store = { read: () => the latest project, save: async project => … } (sync.js gives it).
// Hours (hours/…) and wrap alerts (push/…) are personal: on a crew phone they stay on the phone,
// never sent and never "proposed". And the film's hours/ and push/ files are Ana's: a crew phone
// never downloads them (sync.js), and drops any copy an older version downloaded (ownHoursOnly).

import * as github from './store/github.js';
import { fileContent, applyRemote, hoursFile, pushFile } from './store/repo-files.js';
import { changesBetween, describeChanges, suggestionIssue, readSuggestion, readDecision } from './crew-changes.js';

// A fingerprint no file has: the next download takes the film's version of that file again
// (and a scene preset the film doesn't have is removed, as when it's deleted in the repo).
export const DOWNLOAD_AGAIN = 'download-again';
const DAY = 24 * 3600 * 1000;

// Files that stay on a crew phone only (personal, not the film's).
export function staysOnPhone(path) {
  return path.startsWith('hours/') || path.startsWith('push/');
}

export function crewBook(project) {
  const book = project.crewSuggestions || {};
  return { base: { ...book.base }, sent: { ...book.sent }, log: [...(book.log || [])] };
}

// Files in the outbox already sent as a suggestion (and not changed again since).
export function proposedPaths(project) {
  const sent = project.crewSuggestions?.sent || {};
  return Object.entries(project.outbox || {})
    .filter(([path, entry]) => sent[path] && sent[path].saved_at === entry.saved_at)
    .map(([path]) => path);
}

// A crew phone keeps only its OWN hours and wrap alerts: the ones saved on it, which always stay
// in the outbox (never sent). Any other (Ana's, downloaded by an older version) is dropped.
export function ownHoursOnly(project) {
  const outbox = project.outbox || {};
  const own = (records, fileOf) => Object.fromEntries(Object.entries(records || {}).filter(([key]) => outbox[fileOf(key)]));
  return { ...project, hours: own(project.hours, hoursFile), push: own(project.push, pushFile) };
}

// A download on a crew phone: the film's changes in (remote has no hours/ or push/, sync.js),
// its own hours kept, its proposed files kept.
export function mergeDownload(project, changed, remote) {
  return keepProposed(applyRemote(noteBases(ownHoursOnly(project)), changed, remote));
}

// Before a download: remember which version of the film each changed file started from.
export function noteBases(project) {
  const book = crewBook(project);
  for (const path of Object.keys(project.outbox || {})) {
    if (staysOnPhone(path)) continue;
    const sha = project.shas?.[path];
    if (!(path in book.base)) book.base[path] = sha && sha !== DOWNLOAD_AGAIN ? sha : null;
  }
  return { ...project, crewSuggestions: book };
}

// After a download: a crew phone never has conflicts. While a file is proposed, the phone keeps
// its own version (the film's newer version comes when the suggestion is closed).
export function keepProposed(project) {
  const outbox = project.outbox || {};
  const conflicts = { ...project.conflicts };
  for (const path of Object.keys(conflicts)) if (outbox[path]) delete conflicts[path];
  const book = crewBook(project);
  for (const path of Object.keys(book.base)) if (!outbox[path]) delete book.base[path];
  return { ...project, conflicts, crewSuggestions: book };
}

// Suggestions closed since the last sync: back to the film's version, and a line in the log.
// Returns how many were closed.
export async function takeBackClosed(connection, store) {
  const start = store.read();
  const sent = Object.values(crewBook(start).sent);
  if (!sent.length) return 0;
  const numbers = sent.map(entry => entry.issue);
  const times = sent.map(entry => Date.parse(entry.saved_at)).filter(time => !Number.isNaN(time));
  // a day early: the phone's clock may be wrong
  const since = times.length ? new Date(Math.min(...times) - DAY).toISOString() : undefined;
  const issues = await github.listIssues(connection, { state: 'all', since });
  const closed = issues.map(readSuggestion).filter(suggestion => suggestion && suggestion.state === 'closed'
    && numbers.includes(suggestion.number) && suggestion.by === connection.name && suggestion.film === start.folder);
  if (!closed.length) return 0;

  const decisions = [];
  for (const suggestion of closed) {
    const comments = await github.listComments(connection, suggestion.number);
    decisions.push({ suggestion, decision: readDecision(comments[comments.length - 1]?.body) });
  }
  const project = store.read(); // the person may have saved meanwhile
  const book = crewBook(project);
  const outbox = { ...project.outbox };
  const shas = { ...project.shas };
  for (const { suggestion, decision } of decisions) {
    const path = suggestion.path;
    if (book.sent[path]?.issue !== suggestion.number) continue;
    // changed again after sending: that newer change stays, and is sent as a new suggestion
    const changedAgain = outbox[path] && outbox[path].saved_at !== book.sent[path].saved_at;
    delete book.sent[path];
    if (!changedAgain) {
      delete outbox[path];
      delete book.base[path];
      shas[path] = DOWNLOAD_AGAIN;
    }
    book.log.push({ issue: suggestion.number, path, lines: suggestion.lines, state: decision.state,
      reason: decision.reason, at: new Date().toISOString() });
  }
  await store.save({ ...project, outbox, shas, crewSuggestions: book });
  return decisions.length;
}

// Every changed file not sent yet (or changed again since) → one suggestion.
// A newer suggestion for the same file replaces the older one (which is closed).
// Returns how many suggestions were sent.
export async function sendSuggestions(connection, store) {
  const project = store.read();
  const book = crewBook(project);
  const waiting = Object.entries(project.outbox || {})
    .filter(([path, entry]) => !staysOnPhone(path) && book.sent[path]?.saved_at !== entry.saved_at);
  let count = 0;
  for (const [path, entry] of waiting) {
    const shaNow = project.shas?.[path] !== DOWNLOAD_AGAIN ? project.shas?.[path] : null;
    const baseSha = path in book.base ? book.base[path] : shaNow || null;
    const base = baseSha ? await github.readJsonFile(connection, baseSha) : null;
    const changes = changesBetween(path, base, fileContent(project, path));
    const previous = book.sent[path];
    if (!changes.length) {
      // changed back to how it was: nothing to suggest
      if (previous) await closeOld(connection, previous.issue, 'Withdrawn: back to the film\'s version.');
      await forget(store, path, entry.saved_at);
      continue;
    }
    const lines = describeChanges(path, changes, project, base);
    const details = { by: connection.name, film: project.folder, path, base_sha: baseSha, changes, saved_at: entry.saved_at };
    const issue = await github.createIssue(connection, suggestionIssue(details, lines));
    await remember(store, path, baseSha, { issue: issue.number, saved_at: entry.saved_at, lines });
    if (previous) await closeOld(connection, previous.issue, `Replaced by #${issue.number}`);
    count++;
  }
  return count;
}

async function closeOld(connection, number, text) {
  await github.commentIssue(connection, number, text);
  await github.closeIssue(connection, number, 'not_planned');
}

async function remember(store, path, baseSha, sent) {
  const project = store.read();
  const book = crewBook(project);
  book.sent[path] = sent;
  if (!(path in book.base)) book.base[path] = baseSha;
  await store.save({ ...project, crewSuggestions: book });
}

// The file is the same as the film's: out of the outbox, and downloaded again at the next sync.
async function forget(store, path, savedAt) {
  const project = store.read();
  if (project.outbox?.[path]?.saved_at !== savedAt) return; // changed again meanwhile
  const book = crewBook(project);
  const outbox = { ...project.outbox };
  delete outbox[path];
  delete book.base[path];
  delete book.sent[path];
  await store.save({ ...project, outbox, shas: { ...project.shas, [path]: DOWNLOAD_AGAIN }, crewSuggestions: book });
}
