// film-rules-copy.js — "Copy rules from another film" (Projects → 📋 Film rules, Ana 3 Nov: "if I do again a project
// with Adriano can I import these rules?"). Copies chosen groups of another film's settings.json into the open
// film's; each film still keeps its own copy, to change freely afterwards.
// Never copied: what belongs to one film's cast or one ride — the protagonist (cast #1 is someone else in each
// film), the person Ana rides with and her own name on the call sheet; and the film's own readers, units,
// episodes, calendar and kit (they describe that film's paperwork, not a way of working).
// Used by: screens/film-rules.js

import { loadProject, listProjects } from './store/local.js';
import { getState } from './state.js';
import { saveSettings } from './kit-editing.js';

export const RULE_GROUPS = [
  { id: 'mics', label: 'Mics: who gets a TX, TX order, booms, lavs, mounts', keys: ['presets'] },
  { id: 'day', label: 'Working day, overtime, group cues, voices', keys: ['workday', 'overtime', 'group_cues', 'voices'] },
  { id: 'alarms', label: 'Alarms: times to get ready, walk, drive, rain, leave alarm', keys: ['commute'] },
];
const NOT_COPIED = { presets: ['protagonist'], commute: ['ride_with', 'my_name', 'ride_gap_if_unknown'] };

// the other films on this device (the ones that can be copied from)
export const otherFilms = () => listProjects().filter(p => p.id !== getState().project?.id);

// { changes: settings to write, skipped: what was left out because it belongs to the other film } — no saving
export function rulesToCopy(fromSettings, groupIds) {
  const changes = {};
  const skipped = [];
  for (const group of RULE_GROUPS.filter(g => groupIds.includes(g.id))) {
    for (const key of group.keys) {
      if (fromSettings[key] === undefined) continue;
      const value = structuredClone(fromSettings[key]);
      for (const own of NOT_COPIED[key] || []) {
        if (value && value[own] !== undefined) {
          skipped.push(`${key}.${own}`);
          delete value[own];
        }
      }
      changes[key] = value;
    }
  }
  return { changes, skipped };
}

export async function copyRules(fromProjectId, groupIds) {
  const from = await loadProject(fromProjectId);
  if (!from) return;
  const { changes } = rulesToCopy(from.settings || {}, groupIds);
  await saveSettings(changes, `Rules copied from ${from.name}. Change anything here: ${from.name} keeps its own.`);
}
