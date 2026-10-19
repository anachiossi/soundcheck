// battery-editing.js — saves Gear → Batteries (battery-rules.js): a battery's state, a group of batteries; and,
// apart from them, the mic table's battery column (a TX ON / swapped / OFF).
// At once on the device, then uploaded by sync.js (gear/batteries.json).
// Used by: screens/gear-batteries.js, parts/battery-cell.js

import { getState, saveAndShow, showMessage } from './state.js';
import { batteryFile, withRun, placeOfTx } from './battery-rules.js';
import { syncNow } from './sync.js';

const FILE = 'gear/batteries.json';
const now = () => new Date().toISOString();

async function save(gearBatteries, message) {
  const project = getState().project;
  await saveAndShow({ ...project, gearBatteries, outbox: { ...project.outbox, [FILE]: { saved_at: now() } } });
  if (message) showMessage('ok', message);
  syncNow();
}

// a battery's new state (full / charging / in use / empty): its clock starts again. end: how its run in a TX
// ended (dead / low / ok), kept for learning (battery-rules.js withRun)
export function setBattery(id, fields, end) {
  const project = getState().project;
  const file = batteryFile(project);
  const batteries = file.batteries.map(b => {
    if (b.id !== id) return b;
    const moved = fields.state && fields.state !== b.state;
    const changed = { ...(moved ? withRun(b, end, project) : b), ...fields };
    if (moved) changed.since = now();
    if (changed.state !== 'in_use') delete changed.used_in;
    if (changed.state !== 'charging') { delete changed.charger; delete changed.charge_min; }
    for (const key of Object.keys(changed)) if (changed[key] === undefined) delete changed[key];
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
  const models = Object.fromEntries(Object.entries(fields.models || {}).map(([m, v]) => [m, minutes(v)]).filter(([, v]) => v));
  const wh = fields.wh === '' || fields.wh == null ? undefined : Math.max(0, Math.round(Number(fields.wh) * 10) / 10) || undefined;
  const battery = String(fields.battery || '').trim() || undefined;
  const group = { id, name, battery, wh, life_min: minutes(fields.life_min), charge_min: minutes(fields.charge_min), models: Object.keys(models).length ? models : undefined };
  const groups = fields.id ? file.groups.map(g => (g.id === id ? { ...g, ...group } : g)) : [...file.groups, group];
  const have = file.batteries.filter(b => b.group === id);
  const extra = [];
  for (let label = have.length + 1; label <= Number(fields.count || 0); label++) {
    extra.push({ id: `${id}-${label}`, group: id, label: String(label), state: 'full', since: now() });
  }
  return save({ ...file, groups, batteries: [...file.batteries, ...extra] }, `${name} saved.`);
}

// what a model draws: watts (Wh per hour), how many batteries at once, which battery, where it comes from
export function saveDevice(fields, oldModel) {
  const file = batteryFile(getState().project);
  const model = String(fields.model || '').trim();
  if (!model) return showMessage('error', 'It needs a model.');
  const number = value => (value === '' || value == null ? undefined : Math.max(0, Number(value)) || undefined);
  const device = { model, watts: number(fields.watts), takes: number(fields.takes), hours: number(fields.hours), battery: String(fields.battery || '').trim() || undefined,
    source: String(fields.source || '').trim() || undefined };
  const devices = oldModel ? file.devices.map(d => (d.model === oldModel ? { ...d, ...device } : d)) : [...file.devices, device];
  return save({ ...file, devices }, `${model} saved.`);
}

// add a charger or change one: its name, the group it charges, how many slots, minutes for a full charge
export function saveCharger(fields) {
  const file = batteryFile(getState().project);
  const name = String(fields.name || '').trim();
  if (!name) return showMessage('error', 'It needs a name.');
  const used = new Set(file.chargers.map(c => c.id));
  let n = file.chargers.length + 1;
  while (used.has(`c${n}`)) n++;
  const number = value => (value === '' || value == null ? undefined : Math.max(0, Math.round(Number(value) || 0)));
  const charger = { id: fields.id || `c${n}`, name, group: fields.group || undefined, slots: number(fields.slots), charge_min: number(fields.charge_min) };
  const chargers = fields.id ? file.chargers.map(c => (c.id === charger.id ? charger : c)) : [...file.chargers, charger];
  return save({ ...file, chargers }, `${name} saved.`);
}

// the mic table's battery column: ON (or a swap: a fresh battery, the countdown starts again) or OFF.
// Only the TX's timer changes; Gear → Batteries is never touched (Ana, 19 Oct).
export function switchTx(project, txId, { off = false } = {}) {
  const file = batteryFile(project);
  const txOn = { ...file.tx_on };
  delete txOn[String(txId)];
  if (!off) txOn[String(txId)] = now();
  return save({ ...file, tx_on: txOn }, off ? `${placeOfTx(txId)} OFF.` : `${placeOfTx(txId)} ON.`);
}
