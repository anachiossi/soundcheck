// battery-rules.js — every battery of the film, in Gear → Batteries (Ana, 12 Oct: "monitor all the batteries
// I have on the project": AA for the TXs and plug-ons, NP-F970 for the video kit, built-in ones…).
//   gear/batteries.json  { groups: [{ id, name, item, battery, wh, life_min, charge_min, models: { 'ZMT4.5': 390 } }],
//                          devices: [{ model, watts, takes, battery, hours, source }],
//                          chargers: [{ id, name, group, battery, slots, charge_min }],  (battery: the type it charges, any group)
//                          batteries: [{ id, group, label, state, since, used_in, charger, charge_min, life_pct,
//                                        runs: [{ min, end: 'dead'|'low'|'ok', model, pct, at }] }] }
//   state: 'full' | 'charging' | 'in_use' | 'empty'; since: when it entered that state
//   item: the Gear inventory item the group is (g284…)
//   life_min: estimated minutes in use; models: per TX model (Ana: "ZMT4 lasts longer, others 3.5 h") or per place
//   that isn't a TX ('Mars 4K TX': the video kit)
//   charge_min: minutes on the charger — the battery's own, else its charger's, else the group's
//   life_pct: the battery's rank (old ones less than 100)
//   wh: one battery's energy AS ON ITS LABEL (Ana, 13 Oct: "use always what they have in the label") · devices: what
//   each model draws (W = Wh per hour, from the manuals / makers), how many batteries at once, which battery
//   → the IDEAL minutes = wh × takes ÷ watts. models: the minutes Ana SEES in practice per model — they win.
//   battery 'internal': not swapped (Ana: the Ambient TC boxes) — only the maker's hours on a full charge
//   battery: the group's battery type (NP-F970): the models that take it are the ones its sheet asks about
//   tx_on: { '7': since } — a TX switched ON in the mic table with no numbered battery (v149): its countdown uses the
//   first group of its battery type (the best ones are listed first)
// The mic table's battery column (txTimer, Ana 13 Oct): OFF until tapped while rigging; ON = the battery in use in
// that TX, or tx_on. A timer older than TIMER_STALE_H hours is a forgotten one: it shows OFF again.
// All automatic (Ana, 19 Oct): a battery leaving a TX (swap or OFF) goes straight to Charging; once its charge time
// is up it is ready again (isReady) — no "charging… charged…" taps. Gear → Batteries is for checking, when she wants.
// How long a battery in use lasts (lifeOf), always aiming short (Ana: "end before!"):
//   the model's minutes (the group's own for it, else wh ÷ the device's watts, else the group's) × the battery's rank, no more than its last runs that ended dead or low
//   (dead counts 10% shorter), −15% if its TX is in a long scene today (≥ 3 pages, the AT's rule)
// Colours, always (Ana, 12 Oct: "green, yellow and red — charged are green, used are red"):
//   full green · charging yellow (green once its time is up) · empty red ·
//   in use green, yellow under 30% of its life, red under 10% or past it
// No screen code here. Used by: screens/gear-batteries.js, battery-editing.js, parts/battery-tag.js,
// parts/battery-cell.js, export/image.js

import { naturalCompare, shootingDays, localTodayIso, byId } from './model.js';

export const STATES = [['full', 'Full'], ['charging', 'Charging'], ['in_use', 'In use'], ['empty', 'Empty']];

export const batteryFile = project => ({ groups: [], chargers: [], devices: [], batteries: [], tx_on: {}, ...project.gearBatteries });
export const TIMER_STALE_H = 16;
export const CHARGE_DEFAULT_MIN = 180; // a group with no charge time: 3 hours (Ana, 19 Oct)

export const ENDS = [['dead', 'Dead'], ['low', 'Low'], ['ok', 'Still OK']];
export const LONG_SCENE_PAGES = 3;
export const LONG_SCENE_CUT = 0.85;
const RUNS_KEPT = 10;
const RUNS_LEARNED = 3;
const DEAD_CUT = 0.9;

// the groups, each with its batteries in number order
export function batteryGroups(project) {
  const { groups = [], batteries = [] } = batteryFile(project);
  return groups.map(group => ({
    ...group,
    batteries: batteries.filter(b => b.group === group.id).sort((a, b) => naturalCompare(String(a.label), String(b.label))),
  }));
}

// '2 7/8' → 2.875 pages
export function pagesOf(text) {
  const match = String(text ?? '').trim().match(/^(?:(\d+)\s*)?(?:(\d+)\/(\d+))?$/);
  if (!match || (!match[1] && !match[2])) return 0;
  return Number(match[1] || 0) + (match[2] ? Number(match[2]) / Number(match[3]) : 0);
}

// 'TX 7', '7', 'B1' → the transmitter (TX or boom plug-on) of the film, or null
export function txOf(project, place) {
  const id = String(place || '').trim().replace(/^TX\s*/i, '');
  return id ? (project.transmitters || []).find(t => String(t.id).toLowerCase() === id.toLowerCase()) || null : null;
}

// the battery in use in a TX (null: none marked)
export function batteryIn(project, txId) {
  const { groups, batteries } = batteryFile(project);
  const battery = batteries.find(b => b.state === 'in_use' && String(txOf(project, b.used_in)?.id) === String(txId));
  return battery ? { battery, group: groups.find(g => g.id === battery.group) } : null;
}

// today's shooting day (null: no shooting today)
const todayOf = (project, now) => project.schedule && shootingDays(project).find(d => d.date === localTodayIso(new Date(now))) || null;

// who wears a TX today: the character of its first row in today's scenes
export function wearerOf(project, txId, now = Date.now()) {
  const characters = byId(project.characters || []);
  for (const s of todayOf(project, now)?.scenes || []) {
    const row = project.presets?.[String(s.scene_id)]?.rows?.find(r => String(r.tx_id) === String(txId));
    if (row) return characters.get(String(row.char_id)) || null;
  }
  return null;
}

// today's long scenes with this TX in them
export function longScenesFor(project, txId, now = Date.now()) {
  return (todayOf(project, now)?.scenes || []).map(s => String(s.scene_id)).filter(id =>
    pagesOf(project.scenes?.[id]?.pages) >= LONG_SCENE_PAGES &&
    project.presets?.[id]?.rows?.some(r => String(r.tx_id) === String(txId)));
}

// estimated minutes a battery lasts in use, and why (see the top): { minutes, notes } or null (no estimate)
// what a battery's minutes depend on: its TX's model, its IFB receiver's model ('RX 3'), else the place itself
export function modelOf(project, place) {
  const rx = String(place || '').trim().match(/^RX\s*(.+)$/i);
  const receiver = rx && (project.ifbReceivers || []).find(r => String(r.id) === rx[1]);
  return txOf(project, place)?.model || receiver?.model || String(place || '').trim() || null;
}

// the minutes a battery of the group lasts in a model, from the power it draws (null: not known)
export function minutesFromDraw(project, group, model) {
  const device = batteryFile(project).devices.find(d => d.model === model);
  if (!device?.watts || !group?.wh) return null;
  return Math.round(group.wh * (device.takes || 1) / device.watts * 60);
}

export function lifeOf(project, battery, group, now = Date.now()) {
  const tx = txOf(project, battery.used_in);
  const model = modelOf(project, battery.used_in);
  const pct = Number(battery.life_pct ?? 100);
  const own = model && group?.models?.[model];
  const drawn = !own && model ? minutesFromDraw(project, group, model) : null;
  const base = Number(own || drawn || group?.life_min) || 0;
  const notes = [];
  let minutes = base * pct / 100;
  const kind = own ? ' seen' : drawn ? ' on the label' : '';
  if (base) notes.push(`${own || drawn ? model : group.name}${kind} ${clock(base)}${pct !== 100 ? ` × ${pct}%` : ''}`);
  const runs = (battery.runs || []).filter(r => r.end !== 'ok' && (r.model || null) === model).slice(-RUNS_LEARNED);
  if (runs.length) {
    const learned = Math.min(...runs.map(r => r.min * (r.end === 'dead' ? DEAD_CUT : 1)));
    if (!minutes || learned < minutes) { minutes = learned; notes.push(`its last runs ${clock(Math.round(learned))}`); }
  }
  if (!minutes) return null;
  const long = tx ? longScenesFor(project, tx.id, now) : [];
  if (long.length) { minutes *= LONG_SCENE_CUT; notes.push(`long scene ${long.map(id => `#${id}`).join(' ')} −15%`); }
  return { minutes: Math.round(minutes), notes };
}

// minutes on the charger: the battery's own, its charger's, the group's
export function chargeOf(project, battery, group) {
  const charger = batteryFile(project).chargers.find(c => c.id === battery.charger);
  return Number(battery.charge_min ?? charger?.charge_min ?? group?.charge_min) || CHARGE_DEFAULT_MIN;
}

// where a battery coming out of a TX goes to charge (Ana, 19 Oct: "always the first available slot of charger"):
// the first charger of its group, in the order of Gear → Batteries (the preferred one first), with a free slot;
// a charger with no slot count never fills. null: no charger for the group, or all full.
export function freeChargerFor(project, groupId) {
  return chargersFor(project, groupId).find(c => !c.slots || chargerLoad(project, c.id) < c.slots) || null;
}

// the chargers that charge a group: made for it (group), or for its battery type (battery: 'NP-50' — one charger
// for the new, Pentax and Fuji NP-50s)
export function chargersFor(project, groupId) {
  const { groups, chargers } = batteryFile(project);
  const type = groups.find(g => g.id === groupId)?.battery;
  return chargers.filter(c => c.group === groupId || (type && c.battery === type));
}

// a battery that can go in a TX: full, or charging and its charge time is up (Ana, 19 Oct: "after 3 hours it goes
// back to available, presuming I did my job correctly")
export function isReady(project, battery, group, now = Date.now()) {
  if (battery.state === 'full') return true;
  return battery.state === 'charging' && timeLeft(battery, group, now, project)?.left === 0;
}

// batteries on a charger now
export const chargerLoad = (project, chargerId) =>
  batteryFile(project).batteries.filter(b => b.state === 'charging' && b.charger === chargerId).length;

// minutes left on the charger or in use, and the share of the whole still to go (null: no timer)
// with the project: lifeOf / chargeOf; without it: the group's minutes
export function timeLeft(battery, group, now = Date.now(), project = null) {
  const minutes = battery.state === 'charging' ? (project ? chargeOf(project, battery, group) : Number(battery.charge_min ?? group?.charge_min))
    : battery.state === 'in_use' ? (project ? lifeOf(project, battery, group, now)?.minutes : Number(group?.life_min)) : 0;
  if (!minutes || !battery.since) return null;
  const gone = (now - Date.parse(battery.since)) / 60000;
  return { left: Math.max(0, Math.round(minutes - gone)), share: Math.max(0, 1 - gone / minutes) };
}

export function toneOf(battery, group, now = Date.now(), project = null) {
  if (battery.state === 'full') return 'green';
  if (battery.state === 'empty') return 'red';
  const time = timeLeft(battery, group, now, project);
  if (battery.state === 'charging') return time && time.left === 0 ? 'green' : 'yellow';
  if (!time) return 'green';
  return time.share < 0.1 ? 'red' : time.share < 0.3 ? 'yellow' : 'green';
}

// 125 → '2:05'
export const clock = minutes => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

// a run ends (the battery leaves its TX): what learning keeps, newest last
export function withRun(battery, end, project, now = Date.now()) {
  if (battery.state !== 'in_use' || !end || !battery.since) return battery;
  const run = { min: Math.round((now - Date.parse(battery.since)) / 60000), end, pct: Number(battery.life_pct ?? 100), at: new Date(now).toISOString() };
  const model = modelOf(project, battery.used_in);
  if (model) run.model = model;
  return { ...battery, runs: [...(battery.runs || []), run].slice(-RUNS_KEPT) };
}

export function countsOf(batteries) {
  const counts = Object.fromEntries(STATES.map(([state]) => [state, 0]));
  for (const b of batteries) counts[b.state] = (counts[b.state] || 0) + 1;
  return counts;
}

// 'TX 7' for a numbered TX, 'B1' for a plug-on: what a battery's used_in says
export const placeOfTx = txId => (/^\d+$/.test(String(txId)) ? `TX ${txId}` : String(txId));

// the groups whose batteries fit a TX (its model's battery type), best first (the file's order)
export function groupsForTx(project, txId) {
  const { groups, devices } = batteryFile(project);
  const type = devices.find(d => d.model === txOf(project, txId)?.model)?.battery;
  return type ? groups.filter(g => g.battery === type) : [];
}

// the battery column of a TX: null (OFF) or { battery (null: no number), group, since, minutes, left, endsAt, tone, notes }
export function txTimer(project, txId, now = Date.now()) {
  if (!txId) return null;
  const found = batteryIn(project, txId);
  const since = found?.battery.since || batteryFile(project).tx_on[String(txId)];
  if (!since || now - Date.parse(since) > TIMER_STALE_H * 3600000) return null;
  const group = found?.group || groupsForTx(project, txId)[0] || null;
  const battery = found?.battery || { state: 'in_use', used_in: placeOfTx(txId), since };
  const life = lifeOf(project, battery, group, now);
  const time = timeLeft(battery, group, now, project);
  return { battery: found?.battery || null, group, since, minutes: life?.minutes ?? null, left: time?.left ?? null,
    endsAt: life ? Date.parse(since) + life.minutes * 60000 : null, tone: time ? toneOf(battery, group, now, project) : 'plain', notes: life?.notes || [] };
}

// '10:30' typed in the sheet → that moment today (Ana, 22 Oct: "I forget to click ON; I turned the lavs on around
// 10:30"). A time later than now is yesterday's (past midnight on a night shoot).
export function momentAt(hhmm, now = Date.now()) {
  const [hours, minutes] = String(hhmm).split(':').map(Number);
  const moment = new Date(now);
  moment.setHours(hours, minutes, 0, 0);
  if (moment.getTime() > now) moment.setDate(moment.getDate() - 1);
  return moment.getTime();
}

// '14:35' (the phone's clock)
export const timeOfDay = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
