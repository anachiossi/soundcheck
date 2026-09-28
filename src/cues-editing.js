// cues-editing.js — changing a scene's lines on set (the director cuts or rewrites them).
// Each change is saved at once, on the device, as lines/set/<scene>.json — its own file,
// so a new sides or script from the pipeline never overwrites it — then uploaded by sync.js.
// "Back to the paper" empties that file (the app then shows the sides / script again).
// Used by: screens/cues.js, parts/cue-line-editor.js

import { getState, saveAndShow } from './state.js';
import { cueLines, paperLines } from './cues-rules.js';
import { syncNow } from './sync.js';

async function saveLines(sceneId, change, basedOn) {
  const project = getState().project;
  const current = cueLines(project, sceneId);
  const now = new Date().toISOString();
  const file = {
    scene_id: sceneId,
    based_on: basedOn || (current?.edited ? current.based_on : current?.source || ''),
    edited_at: now,
    lines: change((current?.lines || []).slice()),
  };
  const lines = { ...project.lines, [`set/${sceneId}`]: file };
  const outbox = { ...project.outbox, [`lines/set/${sceneId}.json`]: { saved_at: now } };
  await saveAndShow({ ...project, lines, outbox });
  syncNow();
}

export const changeLine = (sceneId, index, line) =>
  saveLines(sceneId, lines => { lines[index] = line; return lines; });

export const deleteLine = (sceneId, index) =>
  saveLines(sceneId, lines => lines.filter((_, i) => i !== index));

// position: where the new line goes (0 = before the first line)
export const addLineAt = (sceneId, position, line) =>
  saveLines(sceneId, lines => { lines.splice(position, 0, line); return lines; });

export const backToPaper = sceneId => saveLines(sceneId, () => []);

// Newer sides / script arrived after the edits: keep the edits (and stop asking).
export const keepEdits = sceneId =>
  saveLines(sceneId, lines => lines, paperLines(getState().project, sceneId)?.source);
