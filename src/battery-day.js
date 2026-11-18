// battery-day.js — how many batteries a shooting day will use (Gear → Batteries, Ana 18 Nov): for each kind of transmitter
// in the day's scenes, plus the booms: how many are on, how many batteries each takes, how many changes the day needs.
// Batteries are changed at the minutes Ana sees in practice (the group's models, else the label's), so the count aims high.
// Recharging during the day is not counted: the spare is what is left if nothing comes back from the charger.
// No screen code here. Used by: parts/battery-day-plan.js

import { localTodayIso, shootingDays } from './model.js';
import { batteryFile, batteryGroups, groupsForTx, minutesFromDraw } from './battery-rules.js';

const minutesOf = time => {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(String(time || '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

// call to wrap in minutes; a wrap earlier than the call is after midnight
export function dayLength(day) {
  const call = minutesOf(day.call);
  const wrap = minutesOf(day.wrap);
  if (call === null || wrap === null) return null;
  return wrap > call ? wrap - call : wrap + 1440 - call;
}

// the transmitters on that day: the actors' in the main unit's scenes and the booms
function txOfDay(project, day) {
  const worn = day.scenes.flatMap(scene => project.presets?.[String(scene.scene_id)]?.rows || []).map(row => String(row.tx_id || ''));
  const booms = project.settings?.presets?.not_for_actors || [];
  return (project.transmitters || []).filter(tx => worn.includes(String(tx.id)) || booms.includes(String(tx.id)));
}

// the next shooting day with hours, today included
export const nextDay = (project, today = localTodayIso()) => shootingDays(project).find(day => day.date >= today && dayLength(day)) || null;

// → { minutes, lines: [{ battery, have, need, spare, models: [{ model, count, takes, life, changes, need }] }] }
export function batteryPlan(project, day) {
  const minutes = dayLength(day);
  const { devices } = batteryFile(project);
  const groups = batteryGroups(project);
  const byBattery = new Map();
  for (const tx of txOfDay(project, day)) {
    const device = devices.find(item => item.model === tx.model);
    const candidates = groupsForTx(project, tx.id);
    const group = candidates.find(item => item.models?.[tx.model]) || candidates[0];
    if (!device?.battery || !group) continue;
    const life = Number(group.models?.[tx.model] || minutesFromDraw(project, group, tx.model) || group.life_min) || 0;
    if (!life) continue;
    const line = byBattery.get(device.battery) || new Map();
    byBattery.set(device.battery, line);
    const model = line.get(tx.model) || { model: tx.model, count: 0, takes: device.takes || 1, life, changes: Math.ceil(minutes / life) };
    model.count += 1;
    line.set(tx.model, model);
  }
  const lines = [...byBattery].map(([battery, models]) => {
    const list = [...models.values()].map(model => ({ ...model, need: model.count * model.takes * model.changes }));
    const need = list.reduce((sum, model) => sum + model.need, 0);
    const have = groups.filter(group => group.battery === battery).reduce((sum, group) => sum + group.batteries.length, 0);
    return { battery, have, need, spare: have - need, models: list };
  });
  return { minutes, lines };
}
