// proposal-rules.js — applies ONE accepted change from a proposal to the film.
// A proposal (proposals/odg-6.json, written by pipeline/propose.py) lists changes like
//   { id: 'c1', text: 'Day 6: call 09:00 → 09:30', op: { op: 'set_day', day: 6, fields: {…} } }
// applyChange returns the changed film + the repo files it touched (for the outbox).
// No screen code, no saving here.
// Used by: proposals.js

import { presetFile } from './store/repo-files.js';

const OPS = {
  // date / call / wrap of a shooting day
  set_day(film, { day, fields }) {
    film.schedule = film.schedule.map(row => (row.day === day ? { ...row, ...fields } : row));
    return ['schedule.json'];
  },

  // the scenes of a shooting day, in order (a scene moved here leaves its old day)
  set_day_scenes(film, { day, scene_ids }) {
    const template = film.schedule.find(row => row.day === day) || { day, date: '', week: 0, call: '', wrap: '' };
    const kept = film.schedule.filter(row => row.day !== day && !scene_ids.includes(String(row.scene_id)));
    const added = scene_ids.map((sceneId, i) => ({ ...template, scene_id: sceneId, order: i + 1 }));
    film.schedule = [...kept, ...added];
    return ['schedule.json'];
  },

  set_scene_info(film, { scene_id, fields }) {
    film.scenes = { ...film.scenes, [scene_id]: { ...(film.scenes[scene_id] || {}), ...fields } };
    return ['scenes.json'];
  },

  // ODG notes (sound, director, costumes) are added after the scene's own notes
  add_note(film, { scene_id, note }) {
    const info = film.scenes[scene_id] || {};
    const notes = info.notes ? `${info.notes} · ${note}` : note;
    film.scenes = { ...film.scenes, [scene_id]: { ...info, notes } };
    return ['scenes.json'];
  },

  add_row(film, { scene_id, row }) {
    return changeRows(film, scene_id, rows => (rows.some(r => r.char_id === row.char_id) ? rows : [...rows, row]));
  },

  remove_row(film, { scene_id, char_id }) {
    return changeRows(film, scene_id, rows => rows.filter(r => r.char_id !== char_id));
  },

  set_speaker(film, { scene_id, char_id, speaker }) {
    return changeRows(film, scene_id, rows => rows.map(r => (r.char_id === char_id ? { ...r, speaker } : r)));
  },

  add_character(film, { character }) {
    if (!film.characters.some(c => c.id === character.id)) film.characters = [...film.characters, character];
    return ['characters.json'];
  },

  set_character(film, { id, fields }) {
    film.characters = film.characters.map(c => (c.id === id ? { ...c, ...fields } : c));
    return ['characters.json'];
  },
};

function changeRows(film, sceneId, change) {
  const preset = film.presets[sceneId] || { scene_id: sceneId, rows: [] };
  film.presets = { ...film.presets, [sceneId]: { ...preset, rows: change(preset.rows) } };
  return [presetFile(sceneId)];
}

export function applyChange(film, op) {
  const apply = OPS[op.op];
  if (!apply) throw new Error(`Unknown change "${op.op}"`);
  const changed = { ...film };
  const files = apply(changed, op);
  return { film: changed, files };
}

// Proposals still waiting for decisions, newest first.
export function openProposals(film) {
  return Object.values(film.proposals || {})
    .filter(p => p.status !== 'done')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function undecided(proposal) {
  return proposal.changes.filter(change => !proposal.decisions?.[change.id]);
}
