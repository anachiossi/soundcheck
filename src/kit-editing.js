// kit-editing.js — changing the film's characters, transmitters and lavaliers
// (Kit screen), and the IFB crew, receivers and headphones (IFB Kit). Same rules as scene editing: the change is stored on the device
// at once, put in the outbox, and uploaded by sync.js when there is signal.
// Numbers (ids) of existing items can't change, because presets point to them.
// Something used in a preset can't be deleted.
// Used by: screens/kit.js, screens/ifb-kit.js

import { getState, saveAndShow, showMessage } from './state.js';
import { naturalCompare } from './model.js';
import { syncNow } from './sync.js';
import { scenesUsing } from './preset-rules.js';

const LISTS = {
  characters: { file: 'characters.json', one: 'character' },
  transmitters: { file: 'transmitters.json', one: 'TX' },
  lavaliers: { file: 'lavaliers.json', one: 'lav' },
  crew: { file: 'ifb/crew.json', one: 'person', ifbField: 'crew_id' },            // IFB department
  ifbReceivers: { file: 'ifb/receivers.json', one: 'receiver', ifbField: 'rx_id' },
  ifbHeadphones: { file: 'ifb/headphones.json', one: 'headphones', ifbField: 'hp_id' },
};

async function saveList(list, items, message) {
  const project = getState().project;
  const sorted = [...items].sort((a, b) => naturalCompare(a.id, b.id));  // (ids are numbers as text)
  const outbox = { ...project.outbox, [LISTS[list].file]: { saved_at: new Date().toISOString() } };
  await saveAndShow({ ...project, [list]: sorted, outbox });
  showMessage('ok', message + (navigator.onLine ? '' : ' It will upload when there is signal.'));
  syncNow();
}

// isNew: adding (the id must be new); otherwise replaces the item with the same id.
// Empty fields are left out, so the files stay short.
// the film's settings.json (e.g. the read-aloud voices): only the given parts change
export async function saveSettings(changes, message) {
  const project = getState().project;
  const outbox = { ...project.outbox, 'settings.json': { saved_at: new Date().toISOString() } };
  await saveAndShow({ ...project, settings: { ...project.settings, ...changes }, outbox });
  showMessage('ok', message);
  syncNow();
}

export async function saveItem(list, item, isNew) {
  const project = getState().project;
  const clean = Object.fromEntries(Object.entries(item)
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    .filter(([, value]) => value !== '' && value !== undefined && value !== null));
  if (!clean.id) return showMessage('error', 'It needs a number (id).');
  const exists = project[list].some(existing => String(existing.id) === String(clean.id));
  if (isNew && exists) return showMessage('error', `${LISTS[list].one} ${clean.id} already exists.`);
  const others = project[list].filter(existing => String(existing.id) !== String(clean.id));
  await saveList(list, [...others, clean], `${LISTS[list].one} ${clean.id} saved.`);
  return true;
}

export async function deleteItem(list, id) {
  const project = getState().project;
  const { ifbField } = LISTS[list];
  if (ifbField && (project.ifbList?.rows || []).some(row => String(row[ifbField]) === String(id))) {
    return showMessage('error', `${LISTS[list].one} ${id} is on the IFB list. Take it off the list first.`);
  }
  const used = ifbField ? [] : scenesUsing(project, list, id);
  if (used.length) {
    return showMessage('error', `${LISTS[list].one} ${id} is used in scene ${used.slice(0, 6).map(s => '#' + s).join(', ')}${used.length > 6 ? '…' : ''}. Take it out of those scenes first.`);
  }
  await saveList(list, project[list].filter(item => String(item.id) !== String(id)), `${LISTS[list].one} ${id} deleted.`);
  return true;
}
