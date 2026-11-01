// kit-battery-requests.js — battery requests from the kit website (Ana, 1 Nov: "new batteries are bought every job").
// On the site's Batteries section: a pencil on each group (its name, how many in all, a note), "Add batteries" in each
// group (how many new ones) and "Add a battery type" at the end. Like the gear requests (kit-requests.js), the kit only
// grows: new batteries are numbered after the last one in their group, fewer is only a note, nothing is deleted.
//
// A battery request (written by the site, tools/kit_site_edit.html in soundcheck-data):
//   { kind: 'battery', mode: 'edit', item: 'b2', name, count (how many in all), notes, … }   change a group
//   { kind: 'battery', mode: 'add',  item: 'b2', count (how many new), notes, … }             new batteries in a group
//   { kind: 'battery', mode: 'add',  item: '',   name, battery ('NP-F970'), count, notes, … }  a new battery type
// Plain data in, plain data out. Used by: kit-requests.js (draftOf, changeOf, describe), kit-approve.js, screens/kit-requests.js

import { batteryFile } from './battery-rules.js';

const day = at => (at ? String(at).slice(0, 10) : '');
const whoAndWhen = request => [request.who || 'someone', day(request.at)].filter(Boolean).join(', ');
export const isBatteryRequest = request => request?.kind === 'battery';
const groupOf = (project, id) => batteryFile(project).groups.find(group => group.id === id) || null;
const countIn = (project, id) => batteryFile(project).batteries.filter(battery => battery.group === id).length;

// the form Ana tidies: name, how many (in all for a change, new ones for an add), battery model (a new type), note
export function batteryDraftOf(project, request) {
  const group = groupOf(project, request.item);
  const changing = request.mode === 'edit';
  return {
    kind: 'battery',
    name: String(request.name || group?.name || '').trim(),
    battery: String(request.battery || group?.battery || '').trim(),
    qty: Number(request.count) || (changing ? countIn(project, request.item) : 1),
    note: String(request.notes || '').trim(),
  };
}

// What approving does: { battery: { id (none = a new type), name, battery, add: how many new, note } } or { problem }
export function batteryChangeOf(project, request, draft) {
  const by = whoAndWhen(request);
  const note = draft.note ? `${by}: ${draft.note}` : '';
  if (request.item) {
    const group = groupOf(project, request.item);
    if (!group) return { problem: 'That battery group is no longer in the list.' };
    const add = request.mode === 'edit' ? Math.max(0, draft.qty - countIn(project, group.id)) : Math.max(0, draft.qty);
    return { battery: { id: group.id, name: draft.name || group.name, battery: group.battery, add, note } };
  }
  if (!draft.name) return { problem: 'It needs a name: write one before approving.' };
  return { battery: { id: '', name: draft.name, battery: draft.battery, add: Math.max(0, draft.qty),
    note: [`added from the kit website (${by})`, draft.note].filter(Boolean).join(': ') } };
}

// the request in plain lines, for Ana's card
export function describeBattery(project, request) {
  const group = groupOf(project, request.item);
  const have = group ? countIn(project, group.id) : 0;
  const lines = [];
  if (request.item && !group) lines.push('Batteries: a group no longer in the list');
  else if (request.mode === 'edit') {
    lines.push(`Batteries: ${group.name} (${have})`);
    if (request.name && request.name.trim() !== group.name) lines.push(`Name → ${request.name.trim()}`);
    if (request.count && Number(request.count) !== have) {
      lines.push(Number(request.count) > have ? `How many: ${have} → ${request.count} (${Number(request.count) - have} new)`
        : `How many: ${have} → ${request.count} (fewer: kept as a note, nothing deleted)`);
    }
  } else if (group) lines.push(`+ ${request.count || 1} new ${Number(request.count) === 1 ? 'battery' : 'batteries'} in ${group.name} (now ${have})`);
  else lines.push(`+ New battery type: ${request.name || '(no name)'}${request.battery ? ` (${request.battery})` : ''}${request.count ? ` ×${request.count}` : ''}`);
  return lines;
}
