// on-film.test.js — a film takes from the kit only what it uses (gear-rules.js onThisFilm): the film shows those
// things everywhere, the kit keeps them all. Made-up names. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeItems, kitItems, itemById, truckOf } from '../src/gear-rules.js';

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
