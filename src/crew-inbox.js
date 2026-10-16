// crew-inbox.js — on Ana's own devices (the owner), during sync: the crew's suggestions to approve.
//   1. decisions taken on this device (crew-decisions.js) are written on their suggestion
//      (a comment "approved" / "not approved: <reason>", then closed). An approved one waits
//      until its file has been uploaded; a "not approved" one goes at once.
//   2. the open suggestions of the film are listed (only the newest per person and file),
//      and the crew's open feedback (crew-feedback.js); "Mark as read" closes it with "thanks".
// Names Ana removed (Projects → Share with crew, crew-device.js) are ignored: their suggestions
// and feedback are not shown and not closed.
// Crew phones read those comments (crew-changes.js readDecision): they must start exactly with
// "approved" / "not approved", and never name Ana.
// No screens, no saving here. Used by: crew-inbox-sync.js (owner devices only), sync.js, crew-decisions.js.

import * as github from './store/github.js';
import { readSuggestion } from './crew-changes.js';
import { readFeedback } from './crew-feedback.js';

// Errors that mean "this key can't see issues" (or the repo has none): no suggestions, no message.
const NO_ACCESS = [401, 403, 404, 410];

// Open suggestions for this film → [{ issue, by, path, changes, base_sha, lines, created_at, film }]
// Only the newest per person and file: an older one for the same file counts as replaced.
// Removed by Ana? (the same name with other capitals or spaces counts too)
export function isRemovedName(removed, name) {
  const plain = text => String(text || '').trim().toLowerCase();
  return (removed || []).some(item => plain(item) === plain(name));
}

export function newestSuggestions(issues, folder, removed = []) {
  const found = [];
  for (const issue of issues) {
    const suggestion = readSuggestion(issue);
    if (!suggestion || issue.state !== 'open' || suggestion.film !== folder) continue;
    if (isRemovedName(removed, suggestion.by)) continue;
    found.push({ issue: suggestion.number, by: suggestion.by, path: suggestion.path, changes: suggestion.changes,
      base_sha: suggestion.base_sha, lines: suggestion.lines, created_at: issue.created_at || '', film: folder });
  }
  // newest first: by time, then by number (a newer issue has a bigger number)
  found.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.issue - a.issue);
  const seen = new Set();
  const newest = [];
  for (const suggestion of found) {
    const key = `${suggestion.by}\n${suggestion.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    newest.push(suggestion);
  }
  return newest.reverse(); // oldest first, as they came in
}

// The crew's open feedback for this film, oldest first.
export function openFeedback(issues, folder, removed = []) {
  return issues.map(readFeedback)
    .filter(feedback => feedback && feedback.state === 'open' && feedback.film === folder && !isRemovedName(removed, feedback.by))
    .sort((a, b) => a.issue - b.issue);
}

// One look at the open issues → { suggestions, feedback }
export async function loadInbox(connection, folder, removed = []) {
  try {
    const issues = await github.listIssues(connection, { state: 'open' });
    return { suggestions: newestSuggestions(issues, folder, removed), feedback: openFeedback(issues, folder, removed) };
  } catch (error) {
    if (NO_ACCESS.includes(error.status)) return { suggestions: [], feedback: [] };
    throw error;
  }
}

// "Mark as read": a short thank-you (no name), then closed.
export async function closeFeedback(connection, number) {
  await github.commentIssue(connection, number, 'thanks');
  await github.closeIssue(connection, number, 'completed');
}

// The comment a suggestion is closed with (crew phones read its first words).
export function decisionComment(decision) {
  if (decision.decision === 'approved') return 'approved';
  return decision.reason ? `not approved: ${decision.reason}` : 'not approved';
}

// Decisions ready to be sent: "not approved" always; "approved" once its file is uploaded
// (no longer waiting in the outbox, and not in a conflict).
export function readyDecisions(decisions, project) {
  return (decisions || []).filter(decision => decision.film === project.folder
    && (decision.decision !== 'approved' || (!project.outbox?.[decision.path] && !project.conflicts?.[decision.path])));
}

// Comments on and closes each ready suggestion. Returns the issue numbers that are done
// (sent, or the issue is gone). Stops at the first other error: the rest wait for the next sync.
export async function sendDecisions(connection, project, decisions) {
  const done = [];
  for (const decision of readyDecisions(decisions, project)) {
    try {
      await github.commentIssue(connection, decision.issue, decisionComment(decision));
      await github.closeIssue(connection, decision.issue, decision.decision === 'approved' ? 'completed' : 'not_planned');
    } catch (error) {
      if (error.status !== 404 && error.status !== 410) break;
    }
    done.push(decision.issue);
  }
  return done;
}

// The end of the upload's commit message when an uploaded file holds an approved suggestion:
//   " — proposed by Davide, approved"   (two people: "proposed by Davide and Marta")
export function approvalNote(paths, decisions, folder) {
  const names = [];
  for (const decision of decisions || []) {
    const counts = decision.decision === 'approved' && decision.film === folder && paths.includes(decision.path);
    if (counts && !names.includes(decision.by)) names.push(decision.by);
  }
  if (!names.length) return '';
  const people = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return ` — proposed by ${people}, approved`;
}
