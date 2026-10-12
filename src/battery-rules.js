// battery-rules.js — every battery of the film, in Gear → Batteries (Ana, 12 Oct: "monitor all the batteries
// I have on the project": AA for the TXs and plug-ons, NP-F970 for the video kit, built-in ones…).
//   gear/batteries.json  { groups: [{ id, name, life_min, charge_min }],
//                          batteries: [{ id, group, label, state, since, used_in, charge_min }] }
//   state: 'full' | 'charging' | 'in_use' | 'empty'; since: when it entered that state
//   life_min: estimated minutes in use · charge_min: estimated minutes on the charger (a battery can have its own)
// Colours, always (Ana, 12 Oct: "green, yellow and red — charged are green, used are red"):
//   full green · charging yellow (green once its time is up) · empty red ·
//   in use green, yellow under 30% of its life, red under 10% or past it
// No screen code here. Used by: screens/gear-batteries.js, battery-editing.js

import { naturalCompare } from './model.js';

export const STATES = [['full', 'Full'], ['charging', 'Charging'], ['in_use', 'In use'], ['empty', 'Empty']];

export const batteryFile = project => project.gearBatteries || { groups: [], batteries: [] };

// the groups, each with its batteries in number order
export function batteryGroups(project) {
  const { groups = [], batteries = [] } = batteryFile(project);
  return groups.map(group => ({
    ...group,
    batteries: batteries.filter(b => b.group === group.id).sort((a, b) => naturalCompare(String(a.label), String(b.label))),
  }));
}

// minutes left on the charger or in use, and the share of the whole still to go (null: no timer)
export function timeLeft(battery, group, now = Date.now()) {
  const minutes = battery.state === 'charging' ? Number(battery.charge_min ?? group?.charge_min)
    : battery.state === 'in_use' ? Number(group?.life_min) : 0;
  if (!minutes || !battery.since) return null;
  const gone = (now - Date.parse(battery.since)) / 60000;
  return { left: Math.max(0, Math.round(minutes - gone)), share: Math.max(0, 1 - gone / minutes) };
}

export function toneOf(battery, group, now = Date.now()) {
  if (battery.state === 'full') return 'green';
  if (battery.state === 'empty') return 'red';
  const time = timeLeft(battery, group, now);
  if (battery.state === 'charging') return time && time.left === 0 ? 'green' : 'yellow';
  if (!time) return 'green';
  return time.share < 0.1 ? 'red' : time.share < 0.3 ? 'yellow' : 'green';
}

// 125 → '2:05'
export const clock = minutes => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

export function countsOf(batteries) {
  const counts = Object.fromEntries(STATES.map(([state]) => [state, 0]));
  for (const b of batteries) counts[b.state] = (counts[b.state] || 0) + 1;
  return counts;
}
