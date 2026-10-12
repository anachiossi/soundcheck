// battery-editing.js — saves Gear → Batteries (battery-rules.js): a battery's state, a group of batteries.
// At once on the device, then uploaded by sync.js (gear/batteries.json).
// Used by: screens/gear-batteries.js

import { getState, saveAndShow, showMessage } from './state.js';
import { batteryFile } from './battery-rules.js';
import { syncNow } from './sync.js';

const FILE = 'gear/batteries.json';
const now = () => new Date().toISOString();

async function save(gearBatteries, message) {
  const project = getState().project;
  await saveAndShow({ ...project, gearBatteries, outbox: { ...project.outbox, [FILE]: { saved_at: now() } } });
  if (message) showMessage('ok', message);
  syncNow();
}

// a battery's new state (full / charging / in use / empty): its clock starts again
export function setBattery(id, fields) {
  const file = batteryFile(getState().project);
  const batteries = file.batteries.map(b => {
    if (b.id !== id) return b;
    const changed = { ...b, ...fields };
    if (fields.state && fields.state !== b.state) changed.since = now();
    if (changed.state !== 'in_use') delete changed.used_in;
    return changed;
  });
  return save({ ...file, batteries });
}

// add a group (numbered 1…count) or change one; a bigger count adds the next numbers
export function saveGroup(fields) {
  const file = batteryFile(getState().project);
  const name = String(fields.name || '').trim();
  if (!name) return showMessage('error', 'It needs a name.');
  const minutes = value => (value === '' || value == null ? undefined : Math.max(0, Math.round(Number(value) || 0)));
  const used = new Set(file.groups.map(g => g.id));
  let n = file.groups.length + 1;
  while (used.has(`b${n}`)) n++;
  const id = fields.id || `b${n}`;
  const group = { id, name, life_min: minutes(fields.life_min), charge_min: minutes(fields.charge_min) };
  const groups = fields.id ? file.groups.map(g => (g.id === id ? { ...g, ...group } : g)) : [...file.groups, group];
  const have = file.batteries.filter(b => b.group === id);
  const extra = [];
  for (let label = have.length + 1; label <= Number(fields.count || 0); label++) {
    extra.push({ id: `${id}-${label}`, group: id, label: String(label), state: 'full', since: now() });
  }
  return save({ groups, batteries: [...file.batteries, ...extra] }, `${name} saved.`);
}
