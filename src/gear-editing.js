// gear-editing.js — saves the Gear department (gear-rules.js): objects, categories, ticks, and the
// history of what entered, left or changed. At once on the device, then uploaded by sync.js.
// Used by: screens/gear.js

import { getState, saveAndShow, showMessage } from './state.js';
import { categoriesOf, historyOf } from './gear-rules.js';
import { syncNow } from './sync.js';

const today = () => new Date().toISOString();

async function save(changes, files, message) {
  const project = getState().project;
  const outbox = { ...project.outbox };
  for (const file of files) outbox[file] = { saved_at: today() };
  await saveAndShow({ ...project, ...changes, outbox });
  if (message) showMessage('ok', message);
  syncNow();
}

const newId = (list, prefix) => {
  const used = new Set(list.map(x => x.id));
  let n = list.length + 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};

// add (no id) or change an object; the history gets 'added' or 'changed' (not moves)
export function saveObject(fields) {
  const project = getState().project;
  const items = project.gearItems || [];
  const before = fields.id ? items.find(item => item.id === fields.id) : null;
  const object = {
    ...before, ...fields, id: fields.id || newId(items, 'g'), name: String(fields.name || '').trim(),
    qty: Math.max(1, Number(fields.qty) || 1), added: before?.added || today(),
  };
  if (!object.name) return showMessage('error', 'It needs a name.');
  const event = historyOf(before, object);
  const history = event ? [...(project.gearHistory || []), { at: today(), item: object.id, name: object.name, ...event }] : project.gearHistory;
  return save({
    gearItems: before ? items.map(item => (item.id === object.id ? object : item)) : [...items, object],
    gearHistory: history, gearCategories: categoriesOf(project),
  }, ['gear/items.json', 'gear/categories.json', ...(event ? ['gear/history.json'] : [])], `${object.name} saved.`);
}

// an object leaves the list: kept in the history with the date and why
export function removeObject(id, why) {
  const project = getState().project;
  const items = project.gearItems || [];
  const object = items.find(item => item.id === id);
  if (!object) return;
  const inside = items.filter(item => item.inside === id && !item.removed);
  const gearItems = items.map(item => (item.id === id ? { ...item, removed: today(), removed_note: why || '' }
    : item.inside === id ? { ...item, inside: '' } : item)); // what it held stays, loose
  const gearHistory = [...(project.gearHistory || []), { at: today(), item: id, name: object.name, what: 'removed', note: why || '' }];
  return save({ gearItems, gearHistory }, ['gear/items.json', 'gear/history.json'],
    `${object.name} removed${inside.length ? `; ${inside.length} thing(s) it held are now loose` : ''}.`);
}

// a category (or a sub-category, with parent)
export function saveCategory(fields) {
  const project = getState().project;
  const categories = categoriesOf(project);
  const before = fields.id ? categories.find(c => c.id === fields.id) : null;
  const name = String(fields.name || '').trim();
  if (!name) return showMessage('error', 'It needs a name.');
  const id = before?.id || newId(categories, 'c');
  const category = { ...before, ...fields, id, name };
  return save({ gearCategories: before ? categories.map(c => (c.id === id ? category : c)) : [...categories, category] },
    ['gear/categories.json'], `${name} saved.`);
}

export function toggleTick(id) {
  const checks = { ...getState().project.gearChecks };
  if (checks[id]) delete checks[id]; else checks[id] = true;
  return save({ gearChecks: checks }, ['gear/checks.json']);
}

// clear the ticks of some objects (the truck, or one case's contents)
export function clearTicks(ids) {
  const checks = { ...getState().project.gearChecks };
  for (const id of ids) delete checks[id];
  return save({ gearChecks: checks }, ['gear/checks.json'], 'Ticks cleared.');
}
