// kit-requests.js — what the people with the kit website ask (Ana, 29 Oct): change a thing, add one, or say it is
// not on this film / gone for good. They send it from the site; it waits in the kit inbox (kit-inbox.js) until Ana
// approves it in the app (screens/kit-requests.js). Plain data in, plain data out (no network, no screens).
// The kit only ever grows: "not on this film" only takes the thing off THIS film's list (gear/on-film.json), the kit
// keeps it; "gone for good" marks it as removed with the reason (removed_kind: 'gone'), never deletes it. So Ana's
// list keeps everything Angelo and Davide ever had.
//
// A request (written by the site, tools/kit_site_edit.html in soundcheck-data):
//   { v: 1, id, mode: 'edit' | 'add', item: 'g492', kind: 'item' | 'case' | 'pouch' | 'cart' | 'truck',
//     name, count, inside: 'g30' | 'truck' | '', gone: '' | 'film' | 'forever', notes, who, at, photos: ['photo-1.jpg'] }
// Every field may be empty: a note alone is a request too.
// Used by: kit-approve.js, screens/kit-requests.js

import { activeItems, itemById, pathOf } from './gear-rules.js';

// what each kind becomes in the gear list
export const KINDS = {
  item: { label: 'Item', category: 'other' },
  case: { label: 'Case / bag', category: 'cases' },
  pouch: { label: 'Pouch', category: 'pockets' },
  cart: { label: 'Cart', category: 'carts' },
  truck: { label: 'Truck volume', category: 'cases', volume: true },
};

const day = at => (at ? String(at).slice(0, 10) : '');
const whoAndWhen = request => [request.who || 'someone', day(request.at)].filter(Boolean).join(', ');
const nameOf = (project, id) => itemById(project, id)?.name || '';
export const placeText = (project, id) => (id === '' ? 'on the truck (its own volume)'
  : [...pathOf(project, itemById(project, id) || {}), itemById(project, id)].filter(Boolean).map(x => x.name).join(' › '));

// The form Ana tidies before approving, filled from the request (and, for a change, from the thing as it is now).
// inside: an id, '' = on the truck (its own volume); null = leave it where it is.
export function draftOf(project, request) {
  const before = request.mode === 'edit' ? itemById(project, request.item) : null;
  const inside = request.inside === 'truck' ? '' : request.inside || null;
  return {
    kind: KINDS[request.kind] ? request.kind : 'item',
    name: String(request.name || before?.name || '').trim(),
    qty: Number(request.count) || before?.qty || 1,
    inside: inside ?? (before ? before.inside || '' : null),
    note: String(request.notes || '').trim(),
    gone: request.mode === 'edit' && ['film', 'forever'].includes(request.gone) ? request.gone : '',
  };
}

// a new id for an added thing (the same rule as gear-editing.js: the next free g<n>)
export function nextGearId(project) {
  const used = new Set((project.gearItems || []).map(item => item.id));
  let n = (project.gearItems || []).length + 1;
  while (used.has(`g${n}`)) n++;
  return `g${n}`;
}

// What approving does to the gear list:
//   { save: fields for gear-editing.saveObject }, { offFilm: id }, { remove: { id, why, kind: 'gone' } }, or { problem }
export function changeOf(project, request, draft) {
  const by = whoAndWhen(request);
  if (request.mode === 'edit') {
    const before = itemById(project, request.item);
    if (!before) return { problem: 'That thing is no longer in the list.' };
    if (draft.gone === 'film') return { offFilm: before.id };
    if (draft.gone) return { remove: { id: before.id, why: `gone for good (${by})${draft.note ? `: ${draft.note}` : ''}`, kind: 'gone' } };
    const fields = { id: before.id, name: draft.name || before.name, qty: draft.qty };
    if (draft.inside !== null && draft.inside !== (before.inside || '')) {
      fields.inside = draft.inside;
      fields.volume = draft.inside === '';
    }
    if (draft.note) fields.note = [before.note, `${by}: ${draft.note}`].filter(Boolean).join(' · ');
    return { save: fields };
  }
  if (!draft.name) return { problem: 'It needs a name: write one before approving.' };
  const kind = KINDS[draft.kind] || KINDS.item;
  const truck = draft.kind === 'truck' || draft.inside === '';
  return { save: {
    id: nextGearId(project), name: draft.name, qty: draft.qty, category: kind.category,
    inside: truck ? '' : draft.inside || '', volume: truck,
    note: [`added from the kit website (${by})`, draft.note].filter(Boolean).join(': '),
  } };
}

// The request in plain lines, for Ana's card: what they asked, before she tidies it.
export function describe(project, request) {
  const lines = [];
  const before = request.mode === 'edit' ? itemById(project, request.item) : null;
  if (request.mode === 'edit') {
    lines.push(before ? `✏️ Change: ${before.name}${before.inside ? ` (in ${placeText(project, before.inside)})` : ''}`
      : '✏️ Change: a thing no longer in the list');
    if (request.gone === 'film') lines.push('Not on this film');
    if (request.gone === 'forever') lines.push('Gone for good (sold, lost or broken)');
    if (before && request.name && request.name.trim() !== before.name) lines.push(`Name → ${request.name.trim()}`);
    if (before && request.count && Number(request.count) !== (before.qty || 1)) lines.push(`How many: ${before.qty || 1} → ${request.count}`);
    if (before && request.inside && (request.inside === 'truck' ? '' : request.inside) !== (before.inside || '')) {
      lines.push(`Moves to: ${request.inside === 'truck' ? 'the truck (its own volume)' : placeText(project, request.inside) || nameOf(project, request.inside)}`);
    }
  } else {
    const kind = (KINDS[request.kind] || KINDS.item).label.toLowerCase();
    const where = request.inside === 'truck' ? 'on the truck' : request.inside ? `in ${placeText(project, request.inside)}` : '';
    lines.push(`＋ New ${kind}: ${request.name || '(no name)'}${request.count ? ` ×${request.count}` : ''}${where ? ` — ${where}` : ''}`);
  }
  if (request.notes) lines.push(`“${request.notes}”`);
  if (request.photos?.length) lines.push(`📷 ${request.photos.length} ${request.photos.length === 1 ? 'photo' : 'photos'}`);
  return lines;
}

// waiting requests, newest last, grouped by who sent them: [['Davide', [request…]], …]
export function requestsByPerson(requests) {
  const groups = new Map();
  for (const request of [...(requests || [])].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const who = request.who || 'Someone';
    groups.set(who, [...(groups.get(who) || []), request]);
  }
  return [...groups.entries()];
}

// the cases a thing can go into, for the "Where" picker (everything in the list that holds things)
export const placesFor = project => activeItems(project)
  .filter(item => ['carts', 'cases', 'pockets'].includes(item.category))
  .map(item => ({ id: item.id, text: placeText(project, item.id) }))
  .sort((a, b) => a.text.localeCompare(b.text));
