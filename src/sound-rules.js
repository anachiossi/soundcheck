// sound-rules.js — the sound breakdown of a scene (no screen code):
//   level     Ana's dificultômetro, 1–5: MOS · AMB · EASY · MEDIUM · HARD (her colours, from her old ATs)
//   flags     what makes it hard: water, scream, eating, FX, music, car, crowd, kids, animal
//   warnings  per character, for choosing the lav: [{ char_id, kind, text }]
//             e.g. OONA · No lav · "jumps in the pool"
// Stored as sound/<scene>.json (sound-editing.js saves it). Rules from
// docs/2026-09-14_dificultometro_rules.md: the SUGGESTED level only — Ana's choice always wins.
// Used by: parts/sound-bar.js, parts/scene-pill.js, parts/scene-table.js, parts/scene-editor.js, parts/picker.js, export/image.js

export const LEVELS = {
  1: { label: 'MOS', color: '#57DBC2' },
  2: { label: 'AMB', color: '#91E660' },
  3: { label: 'EASY', color: '#EDEA2B' },
  4: { label: 'MEDIUM', color: '#F0BA25' },
  5: { label: 'HARD', color: '#E6405A' },
};

export const FLAGS = {
  water: 'water', scream: 'scream', eating: 'eating', fx: 'FX', music: 'music',
  car: 'car', crowd: 'crowd', kids: 'kids', animal: 'animal',
};

export const WARNING_KINDS = {
  'no-lav': 'No lav', placement: 'Lav placement', water: 'Water', loud: 'Loud', other: 'Other',
};

export const soundOf = (project, sceneId) => project.sound?.[sceneId] || null;

// This scene's warnings for one character.
export function warningsFor(project, sceneId, charId) {
  return (soundOf(project, sceneId)?.warnings || []).filter(w => String(w.char_id) === String(charId));
}

// For Save: a "No lav" character who has a lav in the rows being saved.
export function lavProblems(project, sceneId, rows) {
  const chars = new Map((project.characters || []).map(c => [String(c.id), c.name]));
  return rows
    .filter(row => row.lav_id && warningsFor(project, sceneId, row.char_id).some(w => w.kind === 'no-lav'))
    .map(row => `${chars.get(String(row.char_id)) || row.char_id} has a lav, but: no lav in this scene`);
}

// The dificultômetro suggestion: from who speaks (the preset's YES), INT/EXT and the flags.
// Speakers: 0 → AMB, 1–2 → EASY, 3–4 → MEDIUM, 5+ → HARD; with dialogue, ONE step up for
// EXT with 2 speakers, or scream / FX / crowd / kids / animal, or talking in the water;
// live music → HARD. (Summing every bump overshoots Ana's own ratings, so at most one.)
export function suggestedLevel(project, sceneId) {
  const rows = project.presets?.[sceneId]?.rows || [];
  const speakers = rows.filter(row => row.speaker === 'yes').length;
  const flags = new Set(soundOf(project, sceneId)?.flags || []);
  const ext = /^E/i.test(project.scenes?.[sceneId]?.int_ext || '');
  if (flags.has('music')) return 5;
  if (!speakers) return 2;
  const base = speakers <= 2 ? 3 : speakers <= 4 ? 4 : 5;
  const harder = (ext && speakers === 2) || ['scream', 'fx', 'crowd', 'kids', 'animal', 'water'].some(f => flags.has(f));
  return Math.min(5, base + (harder ? 1 : 0));
}
