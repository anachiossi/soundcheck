// preset-rules.js — rules for editing a scene's preset (no screen code):
// • warnings: the same TX or lav twice in one scene (same frequency on two actors!)
// • suggestions: the TX/lav a character already wears in other scenes that day
// • preferences: the character's preferred TX, and lavs of the preferred model + colour
// Used by: editing.js, kit-editing.js, parts/picker.js, parts/scene-editor.js, screens/kit.js

import { shootingDays, naturalCompare } from './model.js';

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

// From the character's preferences (see model.js): the preferred TX, or the
// lavs of the preferred model in the preferred colour (then just the model).
export function preferredFor(project, charId, field) {
  const character = project.characters.find(c => String(c.id) === String(charId));
  if (!character) return [];
  if (field === 'tx_id') return character.pref_tx ? [String(character.pref_tx)] : [];
  if (field !== 'lav_id') return [];
  const models = [character.pref_lav_model, character.pref_lav_model_2].filter(Boolean).map(m => m.toLowerCase());
  const colour = (character.pref_lav_color || '').toLowerCase();
  if (!models.length && !colour) return [];
  const fits = lav => (!models.length || models.includes(String(lav.model).toLowerCase()));
  const best = project.lavaliers.filter(lav => fits(lav) && (!colour || lav.color.toLowerCase() === colour));
  const rest = project.lavaliers.filter(lav => fits(lav) && !best.includes(lav));
  return [...best, ...(colour && best.length ? [] : rest)].map(lav => String(lav.id));
}

// Scenes whose preset uses this character / TX / lav, e.g. ['2', '11'].
const FIELD = { characters: 'char_id', transmitters: 'tx_id', lavaliers: 'lav_id' };
export function scenesUsing(project, list, id) {
  return Object.values(project.presets)
    .filter(preset => preset.rows.some(row => String(row[FIELD[list]]) === String(id)))
    .map(preset => String(preset.scene_id))
    .sort(naturalCompare);
}

// settings.json → presets.lav_rules.not_used: lav models this film doesn't use (LBE: 6061, Ana 9 Oct)
export function lavNotUsed(project, lav) {
  const models = (project.settings?.presets?.lav_rules?.not_used || []).map(m => String(m).toLowerCase());
  return models.includes(String(lav?.model || '').toLowerCase());
}

// A kit set in one scene stays the same in the other scenes of that day with the same character (Ana, 9 Oct):
// the TX, lav and accessories she set are copied to that character's row there. Only what is set travels (an
// emptied TX — someone who stops speaking — doesn't). If another character there had that TX or lav, theirs
// is emptied: the thing is on this character all day.
// Returns { sceneId: rows } for the scenes that change.
export function sameDayKit(project, sceneId, rows) {
  const day = shootingDays(project).find(d => d.scenes.some(s => String(s.scene_id) === String(sceneId)));
  const changed = {};
  for (const s of day?.scenes || []) {
    const id = String(s.scene_id);
    if (id === String(sceneId) || !project.presets[id]) continue;
    let other = project.presets[id].rows.map(row => ({ ...row }));
    let touched = false;
    for (const row of rows) {
      const there = other.find(r => r.char_id && String(r.char_id) === String(row.char_id));
      if (!there) continue;
      for (const field of ['tx_id', 'lav_id']) {
        if (!row[field] || there[field] === row[field]) continue;
        for (const r of other) if (r !== there && r[field] === row[field]) r[field] = '';
        there[field] = row[field];
        touched = true;
      }
      if (row.acc?.length && JSON.stringify(there.acc || []) !== JSON.stringify(row.acc)) { there.acc = [...row.acc]; touched = true; }
    }
    if (touched) changed[id] = cleanRows(other);
  }
  return changed;
}

// Rows as stored (without the screen-only `key`).
export function cleanRows(rows) {
  return rows.map(({ char_id, tx_id, lav_id, speaker, acc }) => ({ char_id, tx_id, lav_id, speaker, ...(acc?.length ? { acc } : {}) }));
}
