// hours-editing.js — saves the real wrap of a shooting day (hours/<day>.json) and the film's kind of
// working day (settings.json → "workday"): at once on the device, then uploaded by sync.js.
// The answers to the wrap question: on time · not yet (asked again in an hour) · wrapped at hh:mm.
// Also Ana's "My call" for the robots (settings.json → commute "my_name").
// Used by: parts/wrap-clock.js, screens/hours.js, parts/my-call-switch.js

import { getState, saveAndShow, showMessage } from './state.js';
import { hoursFile } from './store/repo-files.js';
import { SNOOZE_MINUTES, WORKDAYS } from './hours-rules.js';
import { shootingDays } from './model.js';
import { saveSettings } from './kit-editing.js';
import { syncNow } from './sync.js';
import { isCrew } from './crew-link.js';
import { isPersonal } from './my-call.js';

async function saveHours(day, fields, message) {
  const { project, connection } = getState();
  const now = new Date().toISOString();
  const info = shootingDays(project).find(d => String(d.day) === String(day));
  const hours = {
    ...project.hours?.[day], day: Number(day), date: info?.date || project.hours?.[day]?.date || '',
    // the ODG's call and wrap too, so the day keeps its hours if a later ODG moves all its scenes away (v150)
    ...(info?.call ? { call: info.call, odg_wrap: info.wrap } : {}), ...fields,
    updated_at: now, updated_by: connection?.device || 'this device',
  };
  const outbox = { ...project.outbox, [hoursFile(day)]: { saved_at: now } };
  await saveAndShow({ ...project, hours: { ...project.hours, [day]: hours }, outbox });
  if (message) showMessage('ok', message);
  syncNow();
}

// "Did today finish on time?" → yes: the real wrap is the ODG's
export const finishedOnTime = (day, wrap) => saveHours(day, { status: 'wrapped', real_wrap: wrap, snooze_until: null }, `Day ${day}: wrap ${wrap}, on time.`);

// → no / "Is this a wrap?" → not yet: asked again in an hour
export const notYet = day => saveHours(day, {
  status: 'late', snooze_until: new Date(Date.now() + SNOOZE_MINUTES * 60000).toISOString(),
}, `Day ${day}: asked again in ${SNOOZE_MINUTES} minutes.`);

// the real wrap, typed (also for a past day, from the Hours screen)
export const wrappedAt = (day, time) => saveHours(day, { status: 'wrapped', real_wrap: time, snooze_until: null }, `Day ${day}: wrap ${time}.`);

// "My call" on Ana's own devices → the robots follow it too (pipeline/wake_plan.py, gmail-trigger.gs):
// Personal with a name → settings.json commute "my_name" = that name; General → no "my_name".
// Crew phones never write it (their My call stays on their phone). Only films with a wake-up plan
// ("commute"): adding one here would switch on the robots' wake notifications. Nothing changed → nothing saved.
export function robotsMyNameAfter(project, connection, setting) {
  const commute = project?.settings?.commute;
  if (isCrew(connection) || !commute) return null;
  const wanted = isPersonal(setting) ? setting.name.trim() : '';
  if ((commute.my_name || '') === wanted) return null;
  const changed = { ...commute };
  if (wanted) changed.my_name = wanted;
  else delete changed.my_name;
  return changed;
}

export function followMyCall(setting) {
  const { project, connection } = getState();
  const commute = robotsMyNameAfter(project, connection, setting);
  if (!commute) return;
  const message = commute.my_name ? `My call: the call of ${commute.my_name} — the robots' alarms follow it too.`
    : 'My call: the general crew call — the robots\' alarms follow it too.';
  return saveSettings({ commute }, message);
}

export function setWorkday(kind) {
  if (!WORKDAYS[kind]) return;
  return saveSettings({ workday: kind }, `Working day: ${WORKDAYS[kind].label}.`);
}
