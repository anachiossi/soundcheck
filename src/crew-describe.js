// crew-describe.js — a crew suggestion in short plain-English lines for people, e.g.
//   "Scene 12: preset changed", "Gear: + Sandbag", "Gear: Umbrella top — note changed",
//   "Characters: Ines — lav changed"
// The names come from the records themselves (name, model, scene number).
// No network, no screens. Used by: crew-changes.js (re-exported), crew-sync.js, later Ana's inbox.

import { fileContent } from './store/repo-files.js';
import { findRecord } from './crew-changes.js';

// What each film file is called for people. Files not listed: "<file> changed".
const FILE_NAMES = {
  'characters.json': 'Characters', 'transmitters.json': 'Transmitters', 'lavaliers.json': 'Lavs',
  'schedule.json': 'Schedule', 'scenes.json': 'Scenes', 'settings.json': 'Settings', 'calls.json': 'Calls',
  'gear/items.json': 'Gear', 'gear/categories.json': 'Gear categories', 'gear/history.json': 'Gear history',
  'gear/checks.json': 'Gear ticks', 'gear/manuals.json': 'Manuals', 'gear/batteries.json': 'Batteries',
  'ifb/crew.json': 'IFB crew', 'ifb/receivers.json': 'IFB receivers', 'ifb/headphones.json': 'IFB headphones',
  'ifb/list.json': 'IFB list', 'film.json': 'Film',
};

// One file per scene / day: one line for the whole file.
const ONE_LINE_FILES = [
  [/^presets\/(.+)\.json$/, number => `Scene ${number}: preset changed`],
  [/^sound\/(.+)\.json$/, number => `Scene ${number}: sound breakdown changed`],
  [/^lines\/[^/]+\/(.+)\.json$/, number => `Scene ${number}: lines changed`],
  [/^hours\/(.+)\.json$/, day => `Day ${day}: hours changed`],
  [/^proposals\/(.+)\.json$/, id => `Proposal ${id} changed`],
];

// Field names for people. Others: underscores become spaces ('removed_note' → 'removed note').
const FIELD_WORDS = {
  pref_tx: 'transmitter', pref_tx_model: 'transmitter', pref_lav_model: 'lav', pref_lav_model_2: 'lav',
  pref_lav_color: 'lav', qty: 'quantity', inside: 'place', call: 'call time', tx_id: 'transmitter',
  lav_id: 'lav', char_id: 'character', rows: 'mics',
};

const fieldWord = field => FIELD_WORDS[field] || field.replace(/_/g, ' ');

// project = the film's data on this device; base = the version the changes started from
// (when not given: the file as it is in `project`).
export function describeChanges(path, changes, project, base) {
  for (const [pattern, line] of ONE_LINE_FILES) {
    const match = pattern.exec(path);
    if (match) return [line(match[1])];
  }
  if (base === undefined && project) base = fileContent(project, path);
  const file = FILE_NAMES[path] || path.replace(/\.json$/, '');
  const lines = [];
  for (const change of changes || []) {
    if (change.op === 'replace') lines.push(`${file} changed`);
    else if ('id' in change) lines.push(recordLine(path, file, change, base));
    else if ('key' in change) lines.push(keyLine(path, file, change, base));
  }
  const unique = [...new Set(lines)];
  return unique.length ? unique : [`${file} changed`];
}

// A record of a list (a character, a gear item, a day in the schedule…).
function recordLine(path, file, change, base) {
  const before = findRecord(path, base, change);
  // a scene shot on two days: "scene 12, day 4"
  const label = recordName(path, change.value || before, change.id) + (change.day != null ? `, day ${change.day}` : '');
  if (change.op === 'remove') return `${file}: − ${label}`;
  if (!before) return `${file}: + ${label}`;
  const fields = changedFields(before, change.value);
  return fields.length ? `${file}: ${label} — ${fields.join(', ')} changed` : `${file}: ${label} changed`;
}

// A key of an object file (a scene in scenes.json, a rule in settings.json…).
function keyLine(path, file, change, base) {
  const before = base && typeof base === 'object' ? base[change.key] : undefined;
  const label = path === 'scenes.json' ? `scene ${change.key}` : fieldWord(change.key);
  if (change.op === 'remove') return `${file}: − ${label}`;
  if (before === undefined) return `${file}: + ${label}`;
  const bothRecords = [before, change.value].every(value => value && typeof value === 'object' && !Array.isArray(value));
  const fields = bothRecords ? changedFields(before, change.value) : [];
  return fields.length ? `${file}: ${label} — ${fields.join(', ')} changed` : `${file}: ${label} changed`;
}

function recordName(path, record, id) {
  if (path === 'schedule.json') return `scene ${id}`;
  if (!record) return String(id);
  if (record.name) return record.name;
  if (record.model) return [record.model, record.color].filter(Boolean).join(' ');
  if (record.label) return record.label;
  return String(id);
}

// 'lav', 'note' … the words for the fields that differ (each word once).
function changedFields(before, after) {
  const names = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const words = [];
  for (const name of names) {
    if (JSON.stringify(before?.[name]) === JSON.stringify(after?.[name])) continue;
    const word = fieldWord(name);
    if (!words.includes(word)) words.push(word);
  }
  return words;
}
