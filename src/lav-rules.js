// lav-rules.js — the film's mic rules, kept in settings.json → "presets" (Film → Lav Rules, Ana 18 Nov). The robot's
// presets (pipeline/presets.py) follow them. What can be chosen comes from the film's own kit.
// Used by: screens/lav-rules.js

import { naturalCompare } from './model.js';
import { saveSettings } from './kit-editing.js';

const LAV_NAMES = { cos11: 'Sanken COS-11', 6060: 'DPA 6060', 6061: 'DPA 6061', 4060: 'DPA 4060', 4061: 'DPA 4061' };
export const lavName = model => LAV_NAMES[model] || model;

const modelsOf = items => [...new Set(items.map(item => String(item.model || '')).filter(Boolean))].sort(naturalCompare);
export const lavModels = project => modelsOf(project.lavaliers || []);
export const txModels = project => modelsOf(project.transmitters || []);
export const txIds = project => (project.transmitters || []).map(tx => String(tx.id)).sort(naturalCompare);

// '1, 2 3' → the TX in that order. unknown: what isn't in the kit · booms: TX kept off actors, left out of the order
export function readTxOrder(text, project, notForActors = []) {
  const typed = [...new Set(String(text).split(/[\s,;]+/).filter(Boolean))];
  const kit = txIds(project);
  return {
    order: typed.filter(id => kit.includes(id) && !notForActors.includes(id)),
    unknown: typed.filter(id => !kit.includes(id)),
    booms: typed.filter(id => notForActors.includes(id)),
  };
}

const isEmpty = value => value === null || value === undefined || value === ''
  || (typeof value === 'object' && !Object.keys(value).length);
const withoutEmpty = rules => Object.fromEntries(Object.entries(rules).filter(([, value]) => !isEmpty(value)));

// the rules after a change: an emptied rule leaves the file. "lav" holds the changes inside lav_rules.
export function rulesWith(rules, { lav = {}, ...changes }) {
  return withoutEmpty({ ...rules, ...changes, same_tx_all_day: true, lav_rules: withoutEmpty({ ...rules.lav_rules, ...lav }) });
}

export function saveLavRules(project, changes, message) {
  return saveSettings({ presets: rulesWith(project.settings?.presets || {}, changes) }, message);
}
