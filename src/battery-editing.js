// battery-editing.js — saves Gear → Batteries (battery-rules.js): a battery's state, a group of batteries, and the mic
// table's battery column (a TX ON / swapped / OFF / asleep).
// At once on the device, then uploaded by sync.js (gear/batteries.json).
// Used by: screens/gear-batteries.js, parts/battery-cell.js

import { getState, saveAndShow, showMessage } from './state.js';
import { batteryFile, withRun, batteryIn, placeOfTx, freeChargerFor, chargersFor } from './battery-rules.js';
import { sleep, wake } from './battery-sleep.js';
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
  // what the form doesn't show (its note, the battery type it charges) stays
  const chargers = fields.id ? file.chargers.map(c => (c.id === charger.id ? { ...c, ...charger } : c)) : [...file.chargers, charger];
  return save({ ...file, chargers }, `${name} saved.`);
}

// the mic table's battery column: the TX's battery ends (how: dead / low / ok, for learning) and goes straight to
// 'charging' on the first charger of its group with a free slot (freeChargerFor; ready again after its charge time,
// battery-rules.js isReady), then batteryId goes in (null: ON with no
// number; off: the TX stays OFF). onAt: when the new battery went in, if not now (ms; Ana forgot to tap ON)
export function switchTx(project, txId, { batteryId = null, end, off = false, onAt = null } = {}) {
  const current = batteryIn(project, txId)?.battery;
  const at = now();
  const on = onAt ? new Date(onAt).toISOString() : at;
  // a TX asleep wakes first: the battery coming out counts only the time it was awake
  const file = wake(batteryFile(project), txId, b => b.id === current?.id, Date.parse(at));
  const batteries = file.batteries.map(b => {
    if (current && b.id === current.id) {
      // no charger can take it (alkaline AA): it is empty, to throw away
      const rechargeable = chargersFor(project, b.group).length > 0;
      const ended = { ...withRun(b, end, project), state: rechargeable ? 'charging' : 'empty', since: at };
      delete ended.used_in;
      const charger = rechargeable && freeChargerFor(project, b.group);
      if (charger) ended.charger = charger.id;
      return ended;
    }
    if (!off && b.id === batteryId) {
      const used = { ...b, state: 'in_use', used_in: placeOfTx(txId), since: on };
      delete used.charger; delete used.charge_min;
      return used;
    }
    return b;
  });
  const txOn = { ...file.tx_on };
  delete txOn[String(txId)];
  if (!off && !batteryId) txOn[String(txId)] = on;
  return save({ ...file, batteries, tx_on: txOn }, off ? `${placeOfTx(txId)} OFF.` : `${placeOfTx(txId)} ON.`);
}

// a TX that is ON: the time it was really turned on (Ana, 22 Oct), so its countdown starts from then
export function setOnTime(project, txId, onAt) {
  const file = batteryFile(project);
  const since = new Date(onAt).toISOString();
  const current = batteryIn(project, txId)?.battery;
  const batteries = file.batteries.map(b => (current && b.id === current.id ? { ...b, since } : b));
  const txOn = current ? file.tx_on : { ...file.tx_on, [String(txId)]: since };
  return save({ ...file, batteries, tx_on: txOn }, `${placeOfTx(txId)} ON since ${new Date(onAt).toTimeString().slice(0, 5)}.`);
}

// sleep mode (battery-sleep.js): the TX's countdown pauses from `at` (ISO, default now) until it wakes at `at`
export function sleepTx(project, txId, at = now()) {
  return save(sleep(batteryFile(project), txId, at), `${placeOfTx(txId)} asleep: its battery timer is paused.`);
}

export function wakeTx(project, txId, at = now()) {
  const current = batteryIn(project, txId)?.battery;
  const file = wake(batteryFile(project), txId, b => b.id === current?.id, Date.parse(at));
  return save(file, `${placeOfTx(txId)} awake: its battery timer goes on.`);
}
