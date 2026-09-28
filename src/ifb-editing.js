// ifb-editing.js — the IFB list: who has which receiver (RX) and headphones (HP),
// ONE list for the whole film, and whether each set is handed out or back.
//   • OUT / ✓ back is a single tap, saved at once
//   • changing who has what: ✎ Edit list → a draft → Save (like editing a scene)
// Saved on the device first, then uploaded by sync.js ('ifb/list.json').
// Used by: screens/ifb-list.js, parts/chooser.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
import { newKey } from './preset-rules.js';
import { syncNow } from './sync.js';

async function saveRows(rows, message) {
  const project = getState().project;
  const now = new Date().toISOString();
  const outbox = { ...project.outbox, 'ifb/list.json': { saved_at: now } };
  await saveAndShow({ ...project, ifbList: { updated_at: now, rows }, outbox });
  if (message) showMessage('ok', message);
  syncNow();
}

const rowsNow = () => getState().project.ifbList?.rows || [];

export function toggleOut(index) {
  const rows = rowsNow().map((row, i) => (i === index ? { ...row, out: !row.out } : row));
  return saveRows(rows);
}

export function setAllOut(out) {
  return saveRows(rowsNow().map(row => ({ ...row, out })), out ? 'All handed out.' : 'All back.');
}

// ---- editing who has what (a draft until Save) ----------------------------------

export function startIfbEdit() {
  const rows = rowsNow().map(row => ({ ...row, key: newKey() }));
  setState({ ifbEdit: rows.length ? rows : [emptyIfbRow()], ifbPicker: null });
}

function emptyIfbRow() {
  return { key: newKey(), crew_id: '', rx_id: '', hp_id: '', out: false };
}

function changeDraft(change) {
  setState({ ifbEdit: change(getState().ifbEdit.slice()) });
}

export const openIfbPicker = (index, field) => setState({ ifbPicker: { index, field } });
export const closeIfbPicker = () => setState({ ifbPicker: null });

export function setIfbCell(index, field, id) {
  changeDraft(rows => { rows[index] = { ...rows[index], [field]: id }; return rows; });
  setState({ ifbPicker: null });
}

export const addIfbRow = () => changeDraft(rows => [...rows, emptyIfbRow()]);
export const deleteIfbRow = index => changeDraft(rows => rows.filter((_, i) => i !== index));
export const cancelIfbEdit = () => setState({ ifbEdit: null, ifbPicker: null });

export async function saveIfbEdit() {
  const rows = getState().ifbEdit
    .filter(row => row.crew_id || row.rx_id || row.hp_id)
    .map(({ crew_id, rx_id, hp_id, out }) => ({ crew_id, rx_id, hp_id, out: Boolean(out) }));
  setState({ ifbEdit: null, ifbPicker: null });
  await saveRows(rows, 'IFB list saved.' + (navigator.onLine ? '' : ' It will upload when there is signal.'));
}
