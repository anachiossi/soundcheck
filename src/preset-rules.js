// preset-rules.js — rules for editing a scene's preset (no screen code):
// • warnings: the same TX or lav twice in one scene (same frequency on two actors!)
// • suggestions: the TX/lav a character already wears in other scenes that day
// • applyOutbox: saved-on-device changes win over older data from the Sheets
// Used by: editing.js, sync.js, parts/picker.js, parts/scene-table.js

import { shootingDays } from './model.js';

export function emptyRow() {
  return { key: newKey(), char_id: '', tx_id: '', lav_id: '', speaker: 'yes' };
}

export function newKey() {
  return Math.random().toString(36).slice(2, 9);
}

// e.g. ['TX 3 is used twice', 'Lav 17 is used twice']
export function warnings(rows) {
  const result = [];
  for (const [field, label] of [['tx_id', 'TX'], ['lav_id', 'Lav'], ['char_id', 'Character']]) {
    const seen = new Map();
    for (const row of rows) {
      if (!row[field]) continue;
      seen.set(row[field], (seen.get(row[field]) || 0) + 1);
    }
    for (const [id, count] of seen) if (count > 1) result.push(`${label} ${id} is used ${count} times`);
  }
  return result;
}

// Ids used by the OTHER rows of the scene, for greying them out in the picker.
export function usedByOtherRows(rows, rowIndex, field) {
  return new Set(rows.filter((_, i) => i !== rowIndex).map(r => r[field]).filter(Boolean));
}

// What this character wears in the other scenes of the same shooting day.
// Returns { tx: ['3'], lav: ['17'] }, most used first.
export function sameDaySuggestions(project, sceneId, charId) {
  const result = { tx: [], lav: [] };
  if (!charId) return result;
  const day = shootingDays(project).find(d => d.scenes.some(s => String(s.scene_id) === String(sceneId)));
  if (!day) return result;
  const counts = { tx: new Map(), lav: new Map() };
  for (const s of day.scenes) {
    if (String(s.scene_id) === String(sceneId)) continue;
    for (const row of project.presets[String(s.scene_id)]?.rows || []) {
      if (String(row.char_id) !== String(charId)) continue;
      if (row.tx_id) counts.tx.set(row.tx_id, (counts.tx.get(row.tx_id) || 0) + 1);
      if (row.lav_id) counts.lav.set(row.lav_id, (counts.lav.get(row.lav_id) || 0) + 1);
    }
  }
  for (const kind of ['tx', 'lav']) {
    result[kind] = [...counts[kind]].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }
  return result;
}

// outbox = { '12': { rows, saved_at } } — changes saved on this device, not uploaded yet.
export function applyOutbox(presets, outbox = {}) {
  const result = { ...presets };
  for (const [sceneId, change] of Object.entries(outbox)) {
    result[sceneId] = { scene_id: sceneId, updated_at: change.saved_at, rows: change.rows };
  }
  return result;
}

// Rows as stored (without the screen-only `key`).
export function cleanRows(rows) {
  return rows.map(({ char_id, tx_id, lav_id, speaker }) => ({ char_id, tx_id, lav_id, speaker }));
}
