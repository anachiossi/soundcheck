// hours-editing.js — saves the real wrap of a shooting day (hours/<day>.json) and the film's kind of
// working day (settings.json → "workday"): at once on the device, then uploaded by sync.js.
// The answers to the wrap question: on time · not yet (asked again in an hour) · wrapped at hh:mm.
// Used by: parts/wrap-clock.js, screens/hours.js

import { getState, saveAndShow, showMessage } from './state.js';
import { hoursFile } from './store/repo-files.js';
import { SNOOZE_MINUTES, WORKDAYS } from './hours-rules.js';
import { shootingDays } from './model.js';
import { saveSettings } from './kit-editing.js';
import { syncNow } from './sync.js';

async function saveHours(day, fields, message) {
  const { project, connection } = getState();
  const now = new Date().toISOString();
  const info = shootingDays(project).find(d => String(d.day) === String(day));
  const hours = {
    ...project.hours?.[day], day: Number(day), date: info?.date || '', ...fields,
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

export function setWorkday(kind) {
  if (!WORKDAYS[kind]) return;
  return saveSettings({ workday: kind }, `Working day: ${WORKDAYS[kind].label}.`);
}
