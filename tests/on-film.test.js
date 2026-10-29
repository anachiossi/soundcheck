// on-film.test.js — a film takes from the kit only what it uses (gear-rules.js onThisFilm): the film shows those
// things everywhere, the kit keeps them all. Made-up names. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeItems, kitItems, itemById, truckOf, quantitiesFor, withFilmQty } from '../src/gear-rules.js';

const kit = {
  gearItems: [
    { id: 'g1', name: 'Cart', category: 'carts', volume: true },
    { id: 'g2', name: 'Speaker bag', category: 'cases', volume: true },
    { id: 'g3', name: 'Speaker', category: 'other', inside: 'g2' },
    { id: 'g4', name: 'Old pole', category: 'poles', removed: '2026-10-01', removed_kind: 'gone' },
  ],
};

test('with no list, the whole kit is on the film (like every film before the kits)', () => {
  assert.deepEqual(activeItems(kit).map(item => item.id), ['g1', 'g2', 'g3']);
});

test('with a list, the film shows only its things; the kit still has them all', () => {
  const film = { ...kit, gearOnFilm: { items: ['g1'] } };
  assert.deepEqual(activeItems(film).map(item => item.id), ['g1']);
  assert.deepEqual(kitItems(film).map(item => item.id), ['g1', 'g2', 'g3']);
  assert.equal(itemById(film, 'g2'), null, 'not on this film: not found by the film\'s screens');
});

test('a thing gone for good is in neither, but stays in the data', () => {
  const film = { ...kit, gearOnFilm: { items: ['g1', 'g4'] } };
  assert.deepEqual(kitItems(film).map(item => item.id), ['g1', 'g2', 'g3']);
  assert.ok(film.gearItems.some(item => item.id === 'g4'));
});

test('the truck counts only what is on this film', () => {
  const film = { ...kit, gearCategories: [], gearOnFilm: { items: ['g1', 'g3'] } };
  assert.deepEqual(truckOf(film).flatMap(group => group.items.map(item => item.name)), ['Cart']);
});

test('a film can take fewer than the kit owns: it shows its own number, the kit keeps its count', () => {
  const film = { gearItems: [{ id: 'g1', name: 'EK 1039', qty: 16 }], gearOnFilm: { items: ['g1'], qty: { g1: 8 } } };
  assert.deepEqual(activeItems(film).map(item => [item.qty, item.kit_qty]), [[8, 16]]);
  assert.equal(kitItems(film)[0].qty, 16);
});

test('typing a quantity on a film: fewer only changes the film, more makes the kit own that many', () => {
  assert.deepEqual(quantitiesFor(16, 8), { kitQty: 16, filmQty: 8 });
  assert.deepEqual(quantitiesFor(16, 16), { kitQty: 16, filmQty: null });
  assert.deepEqual(quantitiesFor(16, 18), { kitQty: 18, filmQty: null });
});

test('a film\'s quantity is kept in its list, and taken away when it takes them all', () => {
  const list = withFilmQty({ items: ['g1'] }, 'g1', 8);
  assert.deepEqual(list, { items: ['g1'], qty: { g1: 8 } });
  assert.deepEqual(withFilmQty(list, 'g1', null), { items: ['g1'], qty: {} });
});
