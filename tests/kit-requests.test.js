// kit-requests.test.js — what a request from the kit website does to the gear list when Ana approves it
// (src/kit-requests.js). The kit only grows: nothing they send can delete. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftOf, changeOf, describe, requestsByPerson, nextGearId, placesFor } from '../src/kit-requests.js';

const film = {
  gearItems: [
    { id: 'g1', name: 'Cart', category: 'carts', volume: true },
    { id: 'g2', name: 'IFB', category: 'cases', inside: 'g1' },
    { id: 'g3', name: 'EK 1039', category: 'other', qty: 16, inside: 'g2', note: 'blue fronts' },
    { id: 'g4', name: 'Old lav', category: 'other', removed: '2026-10-01' },
  ],
};
const at = '2026-10-29T14:00:00.000Z';

test('a change keeps what they left empty as it is now', () => {
  const request = { mode: 'edit', item: 'g3', notes: '2 went to repair', count: '14', who: 'Davide', at };
  const draft = draftOf(film, request);
  assert.deepEqual([draft.name, draft.qty, draft.inside], ['EK 1039', 14, 'g2']);
  assert.deepEqual(changeOf(film, request, draft).save, { id: 'g3', name: 'EK 1039', qty: 14, note: 'blue fronts · Davide, 2026-10-29: 2 went to repair' });
});

test('a change can move a thing into another case, or out onto the truck', () => {
  const into = { mode: 'edit', item: 'g3', inside: 'g1', who: 'Angelo', at };
  assert.deepEqual(changeOf(film, into, draftOf(film, into)).save, { id: 'g3', name: 'EK 1039', qty: 16, inside: 'g1', volume: false });
  const out = { mode: 'edit', item: 'g2', inside: 'truck', at };
  assert.equal(changeOf(film, out, draftOf(film, out)).save.volume, true);
});

test('not on this film only takes it off this film: the kit keeps it', () => {
  const request = { mode: 'edit', item: 'g3', gone: 'film', notes: 'small film', who: 'Angelo', at };
  assert.deepEqual(changeOf(film, request, draftOf(film, request)), { offFilm: 'g3' });
});

test('gone for good is marked too, never deleted', () => {
  const request = { mode: 'edit', item: 'g3', gone: 'forever', at };
  assert.equal(changeOf(film, request, draftOf(film, request)).remove.kind, 'gone');
});

test('an added thing gets a new id, its kind and where it lives', () => {
  const request = { mode: 'add', kind: 'pouch', name: 'Lav spares', count: '2', inside: 'g2', notes: 'red zip', who: 'Davide', at };
  const save = changeOf(film, request, draftOf(film, request)).save;
  assert.deepEqual(save, { id: 'g5', name: 'Lav spares', qty: 2, category: 'pockets', inside: 'g2', volume: false,
    note: 'added from the kit website (Davide, 2026-10-29): red zip' });
});

test('a new truck volume stands on its own on the truck', () => {
  const request = { mode: 'add', kind: 'truck', name: 'Speaker bag', inside: 'truck', at };
  const save = changeOf(film, request, draftOf(film, request)).save;
  assert.deepEqual([save.inside, save.volume, save.category], ['', true, 'cases']);
});

test('an added thing with only a note needs a name before it can be approved', () => {
  const request = { mode: 'add', notes: 'there is a second boom pole', at };
  assert.match(changeOf(film, request, draftOf(film, request)).problem, /needs a name/);
});

test('a change to a thing that left the list cannot be approved', () => {
  const request = { mode: 'edit', item: 'g4', notes: 'found it', at };
  assert.match(changeOf(film, request, draftOf(film, request)).problem, /no longer in the list/);
});

test('the card says in plain words what they asked', () => {
  const request = { mode: 'edit', item: 'g3', count: '14', inside: 'g1', notes: 'two at repair', photos: ['photo-1.jpg'], at };
  assert.deepEqual(describe(film, request),
    ['✏️ Change: EK 1039 (in Cart › IFB)', 'How many: 16 → 14', 'Moves to: Cart', '“two at repair”', '📷 1 photo']);
  assert.deepEqual(describe(film, { mode: 'add', kind: 'truck', name: 'Speaker bag', inside: 'truck' }),
    ['＋ New truck volume: Speaker bag — on the truck']);
});

test('requests are grouped by who sent them, oldest first', () => {
  const groups = requestsByPerson([{ who: 'Davide', at: '2' }, { who: 'Angelo', at: '1' }, { who: 'Davide', at: '0' }, { at: '3' }]);
  assert.deepEqual(groups.map(([who, list]) => [who, list.map(r => r.at)]), [['Davide', ['0', '2']], ['Angelo', ['1']], ['Someone', ['3']]]);
});

test('a new id skips the ones in use, removed ones included', () => {
  assert.equal(nextGearId(film), 'g5');
});

test('the places to choose from are the carts, cases and pouches, with their path', () => {
  assert.deepEqual(placesFor(film).map(p => p.text), ['Cart', 'Cart › IFB']);
});
