// crew-changes.js — what a crew person changed in one film file, written as a short list of
// changes that can be sent as a suggestion and later applied to the film's CURRENT data
// (so changes other people made meanwhile are kept).
// Also: the suggestion's GitHub issue (title + body with the changes inside) and reading it back.
// No network, no screens: plain data in, plain data out.
// Used by: crew-sync.js (crew phones), later Ana's inbox (approve / don't approve).
//
// How a file is compared, by its shape:
//   a list where every item has an id      → one change per id     { op: 'set', id, value } / { op: 'remove', id }
//   schedule.json                           → the same, by scene_id; when a scene is shot on two
//                                             days (scene_id twice), by scene_id + day  { …, id, day }
//   an object (scenes.json, a preset, …)    → one change per key    { op: 'set', key, value } / { op: 'remove', key }
//   anything else, or no earlier version    → the whole file        { op: 'replace', value }

export { describeChanges } from './crew-describe.js';

export const SUGGESTION_MARKER = 'crew-suggestion';
export const SUGGESTION_LABEL = 'crew-proposal';

// The field that tells records apart in a list file: 'scene_id' in the schedule, 'id' elsewhere.
export function idField(path) {
  return path === 'schedule.json' ? 'scene_id' : 'id';
}

// Same content? (the order of the fields inside a record doesn't matter)
export function same(a, b) {
  return sortedText(a) === sortedText(b);
}

function sortedText(value) {
  return JSON.stringify(value === undefined ? null : value, (key, inner) => {
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return inner;
    return Object.fromEntries(Object.keys(inner).sort().map(name => [name, inner[name]]));
  });
}

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// A list whose records can be told apart: every item has the id field, and no id appears twice.
// withDay: tell them apart by id + day (the schedule, when a scene is shot on two days).
function isRecordList(list, field, withDay = false) {
  if (!Array.isArray(list)) return false;
  const ids = list.map(item => (isPlainObject(item) ? item[field] : undefined));
  if (ids.some(id => id === undefined || id === null)) return false;
  const keys = list.map(item => (withDay ? `${item[field]}\n${item.day ?? ''}` : String(item[field])));
  return new Set(keys).size === keys.length;
}

// The record a change is about: by its id, and by its day too when the change has one.
export function findRecord(path, list, change) {
  const field = idField(path);
  return (Array.isArray(list) ? list : []).find(item => isPlainObject(item) && String(item[field]) === String(change.id)
    && (!('day' in change) || String(item.day ?? '') === String(change.day ?? '')));
}

export function changesBetween(path, base, mine) {
  const field = idField(path);
  if (base === undefined || base === null) return [{ op: 'replace', value: mine }];
  const byId = isRecordList(base, field) && isRecordList(mine, field);
  const byDay = !byId && path === 'schedule.json' && isRecordList(base, field, true) && isRecordList(mine, field, true);
  if (byId || byDay) {
    const changeOf = record => (byDay ? { id: record[field], day: record.day ?? null } : { id: record[field] });
    const changes = [];
    for (const record of mine) {
      const change = changeOf(record);
      if (!same(findRecord(path, base, change), record)) changes.push({ op: 'set', ...change, value: record });
    }
    for (const record of base) {
      const change = changeOf(record);
      if (!findRecord(path, mine, change)) changes.push({ op: 'remove', ...change });
    }
    return changes;
  }
  if (isPlainObject(base) && isPlainObject(mine)) {
    const changes = [];
    for (const key of Object.keys(mine)) {
      if (!same(base[key], mine[key])) changes.push({ op: 'set', key, value: mine[key] });
    }
    for (const key of Object.keys(base)) if (!(key in mine)) changes.push({ op: 'remove', key });
    return changes;
  }
  return same(base, mine) ? [] : [{ op: 'replace', value: mine }];
}

// Puts the changes into `current` (the film's data now). A clash = that record was changed by
// someone else since `base` (the version the suggestion started from), and differently.
// Returns { content, clashes: [the changes that clashed] }.
// A clashing 'replace' (the whole file) can't be approved: it would undo the other changes.
export function applyChanges(path, current, changes, base) {
  const clashes = [];
  let content = current;
  for (const change of changes) {
    if (change.op === 'replace') {
      const changedMeanwhile = !same(current, base) && !same(current, change.value);
      if (changedMeanwhile) clashes.push(change);
      content = change.value;
    } else if ('id' in change) {
      const list = Array.isArray(content) ? [...content] : [];
      const now = findRecord(path, list, change);
      const before = findRecord(path, base, change);
      const wanted = change.op === 'set' ? change.value : undefined;
      if (!same(now, before) && !same(now, wanted)) clashes.push(change);
      const at = list.indexOf(now);
      if (change.op === 'remove' && at >= 0) list.splice(at, 1);
      if (change.op === 'set' && at >= 0) list[at] = change.value;
      if (change.op === 'set' && at < 0) list.push(change.value);
      content = list;
    } else if ('key' in change) {
      const object = isPlainObject(content) ? { ...content } : {};
      const before = isPlainObject(base) ? base[change.key] : undefined;
      const wanted = change.op === 'set' ? change.value : undefined;
      if (!same(object[change.key], before) && !same(object[change.key], wanted)) clashes.push(change);
      if (change.op === 'remove') delete object[change.key];
      else object[change.key] = change.value;
      content = object;
    }
  }
  return { content, clashes };
}

// ---- the suggestion as a GitHub issue -----------------------------------------------

// details = { by, film, path, base_sha, changes, saved_at }, lines = describeChanges(…)
export function suggestionIssue(details, lines) {
  const data = { soundcheck: SUGGESTION_MARKER, version: 1, film: details.film, path: details.path,
    base_sha: details.base_sha || null, changes: details.changes, by: details.by, saved_at: details.saved_at };
  // three backticks in a line (a name, a note) would look like the start of the details: made harmless
  const readable = lines.map(line => `- ${String(line).replace(/`{3,}/g, "'''")}`);
  const body = [...readable, '', '```json', JSON.stringify(data, null, 2), '```', ''].join('\n');
  return { title: `Suggestion from ${details.by}: ${lines[0] || details.path}`, body, labels: [SUGGESTION_LABEL] };
}

// A GitHub issue → { number, state, film, path, base_sha, changes, by, saved_at },
// or null when it isn't a soundcheck suggestion (labels are not trusted: they may not exist).
export function readSuggestion(issue) {
  const body = String(issue?.body || '');
  const match = /```json\s*\n([\s\S]*?)\n\s*```/.exec(body);
  if (!match) return null;
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!isPlainObject(data) || data.soundcheck !== SUGGESTION_MARKER || data.version !== 1) return null;
  if (typeof data.path !== 'string' || !Array.isArray(data.changes) || typeof data.by !== 'string') return null;
  // the lines for people: "- …" before the json block
  const lines = body.slice(0, match.index).split('\n')
    .filter(line => line.startsWith('- ')).map(line => line.slice(2).trim());
  return { number: issue.number, state: issue.state, film: data.film, path: data.path, base_sha: data.base_sha ?? null,
    changes: data.changes, by: data.by, saved_at: data.saved_at ?? null, lines };
}

// The comment a suggestion was closed with → { state: 'approved' | 'not approved' | 'closed', reason }
//   "approved"                      → approved
//   "not approved: wrong scene"     → not approved, reason "wrong scene"
export function readDecision(comment) {
  const text = String(comment || '').trim();
  const lower = text.toLowerCase();
  if (lower.startsWith('not approved')) {
    return { state: 'not approved', reason: text.slice('not approved'.length).replace(/^[\s:.,—-]+/, '').trim() };
  }
  if (lower.startsWith('approved')) return { state: 'approved', reason: '' };
  return { state: 'closed', reason: '' };
}
