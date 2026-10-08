// accessories.js — the optional "Acc." column of the mic table (Ana, 8 Oct: "I love the way it is today,
// wanted to add a new column, that's all"). A mic row may carry acc: [gear item ids] — what holds the TX
// (strap, pouch) and what covers the lav (fur, cover, foam). Always optional: the preset generator never
// fills it, an empty cell is fine.
// It takes the place of the Speaks column: the column's label (Speaks ⇄ / Acc. ⇄) swaps it, remembered on
// this phone — the mixer's phone and the exported images keep Speaks.
// The pool is the Gear inventory: every thing whose type is a strap, pouch, fur, cover or foam
// (settings.json → "accessory_types" can name other words for another film).
// A character's usual kit (characters.json → usual_acc: [{ slot, name, gear? }]) is offered on top of the picker.
// Used by: parts/scene-table.js, parts/scene-editor.js, parts/picker.js

import { getState, setState } from './state.js';
import { activeItems, itemById, shortName } from './gear-rules.js';

const KEY = 'sc_show_acc';
const WORDS = ['strap', 'pouch', 'lav fur', 'lav cover', 'overcover', 'foam mount']; // not the mics' foams and furs

export function accOn() {
  const chosen = getState().showAcc;
  if (chosen !== undefined) return chosen;
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}

export function setAccOn(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: for this visit only */ }
  setState({ showAcc: on });
}

const plainText = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// every strap, pouch, fur, cover… in Gear, A–Z
export function accessoryPool(project) {
  const words = (project.settings?.accessory_types || WORDS).map(plainText);
  return activeItems(project)
    .filter(item => words.some(word => plainText(item.type).includes(word)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
}

// the word on an accessory's pill (Ana, 8 Oct): a pouch says Pouch, a fur Fur, a cover Cover; a strap says where it
// goes (Waist, Thigh, Ankle, Chest — the first word of its name without "strap")
export function accLabel(item) {
  const type = plainText(item.type);
  for (const [word, label] of [['pouch', 'Pouch'], ['fur', 'Fur'], ['cover', 'Cover'], ['foam', 'Foam']]) if (type.includes(word)) return label;
  return shortName(item).split(' ')[0];
}

// the gear things of a row: [{ id, name, label, color }] (an id no longer in Gear keeps a plain label)
export function rowAccessories(project, row) {
  return (row.acc || []).map(id => {
    const item = itemById(project, id);
    return item ? { id, name: item.name, label: accLabel(item), color: item.color || '' } : { id, name: id, label: '?', color: '' };
  });
}

// the character's usual kit, as gear ids to offer first: a named gear thing, or every pool thing whose name
// starts the same way ("Ankle strap (any colour)" → Ankle strap beige, Ankle strap black)
export function usualFor(project, character) {
  const pool = accessoryPool(project);
  return (character?.usual_acc || []).flatMap(usual => {
    if (usual.gear && pool.some(item => item.id === usual.gear)) return [usual.gear];
    const start = plainText(String(usual.name || '').replace(/\(.*\)/, '')).trim();
    return start ? pool.filter(item => plainText(item.name).startsWith(start)).map(item => item.id) : [];
  });
}

// how many of a thing the other rows of the scene already use (to say "all in use")
export function usedElsewhere(rows, rowIndex, id) {
  return rows.filter((row, i) => i !== rowIndex && (row.acc || []).includes(id)).length;
}
