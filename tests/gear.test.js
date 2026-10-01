// gear.test.js — the Gear department: categories and sub-categories, what a case holds, the truck,
// and which edits go in the history (not moves, not ticks). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTING_CATEGORIES, topOf, contentsOf, truckOf, allInCategory, historyOf, tickCount, containersOf } from '../src/gear-rules.js';
import { fileContent, setFileContent } from '../src/store/repo-files.js';

const film = {
  gearCategories: [...STARTING_CATEGORIES, { id: 'c7', name: 'Batteries', color: '#f00', parent: 'cases' }],
  gearItems: [
    { id: 'g1', name: 'Pelican yellow', category: 'cases', volume: true },
    { id: 'g2', name: 'AA', category: 'c7', qty: 16, inside: 'g1' },
    { id: 'g3', name: 'XLR 3m', category: 'cables', qty: 6, inside: 'g1' },
    { id: 'g4', name: 'XLR 30m', category: 'cables', qty: 2 },
    { id: 'g5', name: 'Chair', category: 'other', volume: true, removed: '2026-10-01', removed_note: 'back to Angelo' },
  ],
  gearChecks: { g1: true },
};

test('a sub-category belongs to its tab', () => {
  assert.equal(topOf(film, 'c7').id, 'cases');
});

test('a case holds its things, by category', () => {
  assert.deepEqual(contentsOf(film, 'g1').map(g => [g.category.name, g.items.map(i => i.name)]), [['Batteries', ['AA']], ['Cables', ['XLR 3m']]]);
});

test('the truck: volumes only, removed ones gone; ticks counted', () => {
  const truck = truckOf(film);
  assert.deepEqual(truck.map(g => [g.category.id, g.items.map(i => i.id)]), [['cases', ['g1']]]);
  assert.deepEqual(tickCount(film, truck[0].items), { done: 1, all: 1 });
});

test('Cables lists every cable, also those in a case', () => {
  assert.deepEqual(allInCategory(film, 'cables').map(i => i.name), ['XLR 3m', 'XLR 30m']);
});

test('history: added, changed name / quantity — a move between cases is not history', () => {
  assert.deepEqual(historyOf(null, { name: 'AA' }), { what: 'added' });
  assert.equal(historyOf({ name: 'AA', qty: 16, inside: 'g1' }, { name: 'AA', qty: 16, inside: 'g9' }), null);
  assert.deepEqual(historyOf({ name: 'AA', qty: 16 }, { name: 'AA', qty: 12 }), { what: 'changed', note: 'quantity: 16 → 12' });
});

test('gear files travel with the film', () => {
  const project = {};
  setFileContent(project, 'gear/items.json', film.gearItems);
  assert.equal(fileContent(project, 'gear/items.json').length, 5);
});

test('a case in a cart: its own volume or fixed to the cart; no loops', () => {
  const carts = { ...film, gearItems: [
    { id: 'k1', name: 'Main Karl', category: 'carts', volume: true },
    { id: 'c1', name: 'Slate 1', category: 'cases', volume: true, inside: 'k1' },   // rides in the cart, own volume
    { id: 'c2', name: 'Drawer', category: 'cases', volume: false, inside: 'k1' },   // fixed to the cart
  ] };
  assert.deepEqual(truckOf(carts).flatMap(g => g.items.map(i => i.id)), ['k1', 'c1']);
  assert.deepEqual(contentsOf(carts, 'k1')[0].items.map(i => i.id), ['c1', 'c2']);
  assert.deepEqual(allInCategory(carts, 'cases').map(i => i.id), ['c1', 'c2'], 'the Cases tab shows them too');
  assert.deepEqual(containersOf(carts, 'k1').map(i => i.id), [], 'the cart cannot go into a case that is in it');
});
