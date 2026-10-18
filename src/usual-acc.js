// usual-acc.js — what holds the TX, from the character (Ana, 18 Oct): "all scenes from today on to have the TX
// accessories preset as we set … I will change only in case of need". A row with a TX and no strap or pouch yet
// gets the character's usual one (characters.json → usual_acc, Kit; LBE's came from scene 27fin).
// A row that already has a TX accessory keeps it: what Ana picked by hand wins.
// Used by: editing.js (saving a scene), proposal-rules.js (a preset review)

import { itemById } from './gear-rules.js';
import { accSide } from './accessories.js';

// one row with the character's usual TX accessory added when it has a TX and none yet
export function withUsualTxAcc(project, row) {
  if (!row.tx_id || !row.char_id) return row;
  const character = (project.characters || []).find(c => String(c.id) === String(row.char_id));
  const usual = (character?.usual_acc || []).map(u => u.gear).filter(Boolean)
    .filter(id => accSide(itemById(project, id)) === 'tx');
  const hasTxAcc = (row.acc || []).some(id => accSide(itemById(project, id)) === 'tx');
  if (!usual.length || hasTxAcc) return row;
  return { ...row, acc: [...usual, ...(row.acc || [])] };
}

// The rows of a scene after an edit: a row whose TX changed (or a new row with a TX) gets the usual accessory.
// savedRows = the scene's rows before the edit ([] for a new scene or a preset review: every row counts).
export function applyUsualTxAcc(project, rows, savedRows = []) {
  return rows.map(row => {
    const before = savedRows.find(r => r.char_id && String(r.char_id) === String(row.char_id));
    const txChanged = !before || String(before.tx_id || '') !== String(row.tx_id || '');
    return txChanged ? withUsualTxAcc(project, row) : row;
  });
}
