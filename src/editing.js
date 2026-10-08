// editing.js — changing a scene's preset, from Schedule or Scenes.
// ✎ Edit makes a DRAFT copy of the scene's rows. Nothing changes until Save.
// The draft is remembered on the device, so a phone that locks or restarts
// doesn't lose it. Save = stored on the device at once + put in the outbox;
// sync.js uploads the outbox when there is signal.
// Used by: parts/scene-editor.js, parts/picker.js, parts/scene-table.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
import { emptyRow, newKey, cleanRows } from './preset-rules.js';
import { syncNow } from './sync.js';
import { presetFile } from './store/repo-files.js';

const SPEAKER_NEXT = { yes: 'no', no: 'maybe', maybe: 'yes' };

export function startEdit(sceneId) {
  const { edit, project } = getState();
  if (edit && edit.sceneId !== sceneId) {
    return showMessage('error', `Save or cancel scene #${edit.sceneId} first.`);
  }
  const rows = (project.presets[sceneId]?.rows || []).map(row => ({ ...row, key: newKey() }));
  setState({ edit: { sceneId, rows: rows.length ? rows : [emptyRow()] }, message: null });
}

function changeRows(change) {
  const { edit } = getState();
  setState({ edit: { ...edit, rows: change(edit.rows.slice()) } });
}

export const openPicker = (rowIndex, field) => setState({ picker: { rowIndex, field } });
export const closePicker = () => setState({ picker: null });

// field: 'char_id' | 'tx_id' | 'lav_id'; id '' empties the cell.
export function setCell(rowIndex, field, id) {
  changeRows(rows => {
    rows[rowIndex] = { ...rows[rowIndex], [field]: id };
    return rows;
  });
  setState({ picker: null });
}

// the Acc. column: a gear thing in or out of the row (several allowed; the picker stays open)
export function toggleAcc(rowIndex, id) {
  changeRows(rows => {
    const acc = rows[rowIndex].acc || [];
    rows[rowIndex] = { ...rows[rowIndex], acc: acc.includes(id) ? acc.filter(x => x !== id) : [...acc, id] };
    return rows;
  });
}

export function cycleSpeaker(rowIndex) {
  changeRows(rows => {
    rows[rowIndex] = { ...rows[rowIndex], speaker: SPEAKER_NEXT[rows[rowIndex].speaker] || 'yes' };
    return rows;
  });
}

export const addRow = () => changeRows(rows => [...rows, emptyRow()]);
export const deleteRow = rowIndex => changeRows(rows => rows.filter((_, i) => i !== rowIndex));

export function moveRow(rowIndex, step) {
  changeRows(rows => {
    const target = rowIndex + step;
    if (target < 0 || target >= rows.length) return rows;
    [rows[rowIndex], rows[target]] = [rows[target], rows[rowIndex]];
    return rows;
  });
}

export const cancelEdit = () => setState({ edit: null, picker: null });

export async function saveEdit() {
  const { edit, project } = getState();
  // Rows with nothing in them are dropped.
  const rows = cleanRows(edit.rows).filter(r => r.char_id || r.tx_id || r.lav_id);
  const savedAt = new Date().toISOString();
  const presets = { ...project.presets, [edit.sceneId]: { scene_id: edit.sceneId, updated_at: savedAt, rows } };
  const outbox = { ...project.outbox, [presetFile(edit.sceneId)]: { saved_at: savedAt } };
  await saveAndShow({ ...project, presets, outbox }, { edit: null, picker: null });
  showMessage('ok', `Scene #${edit.sceneId} saved.` + (navigator.onLine ? '' : ' It will upload when there is signal.'));
  syncNow();
}
