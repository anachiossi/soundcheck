// gear.test.js — the Gear department: categories and sub-categories, what a case holds, the truck,
// and which edits go in the history (not moves, not ticks). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTING_CATEGORIES, topOf, contentsOf, truckOf, allInCategory, historyOf, tickCount, containersOf, isContainer } from '../src/gear-rules.js';
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

test('batteries in a case are contents, not a container', () => {
  assert.equal(isContainer(film, film.gearItems[0]), true, 'the Pelican');
  assert.equal(isContainer(film, film.gearItems[1]), false, 'AA (Cases → Batteries)');
  assert.deepEqual(containersOf(film, 'g4').map(i => i.id), ['g1'], 'XLR 30m can go into the Pelican, not into the AA');
});

test('search: words in name, nicknames, type or category; with the path', async () => {
  const { searchGear } = await import('../src/gear-rules.js');
  const kit = { ...film, gearItems: [
    { id: 'm', name: 'Magliner', category: 'carts' },
    { id: 'p', name: 'Pelican yellow', category: 'cases', type: 'Pelican', inside: 'm', nicknames: ['slate case'] },
    { id: 'w', name: 'Schoeps CMIT', category: 'cases', type: 'wood box', inside: 'p' },
    { id: 'x', name: 'XLR 3m', category: 'cables', qty: 6, inside: 'p' },
    { id: 'b', name: 'BNC-SMA', category: 'cables', qty: 2, inside: 'm' },
  ] };
  const paths = q => searchGear(kit, q).map(r => [...r.path.map(p => p.name), r.item.name].join(' › '));
  assert.deepEqual(paths('xlr cable'), ['Magliner › Pelican yellow › XLR 3m']);
  assert.deepEqual(paths('wood box'), ['Magliner › Pelican yellow › Schoeps CMIT'], 'a case inside a case inside a cart');
  assert.deepEqual(paths('slate'), ['Magliner › Pelican yellow'], 'by nickname');
  assert.deepEqual(paths('cables').length, 2);
});

// ---- the inventory tree, details by type, the truck's numbering (Ana, 2 Oct) ----
const intMics = { ...film, gearItems: [
  { id: 'k', name: 'Magliner', category: 'carts' },
  { id: 'b', name: 'BNC–SMA cable', category: 'cables', type: 'cable', qty: 2, inside: 'k',
    details: [{ label: 'Connector A', value: 'BNC' }, { label: 'Connector B', value: 'SMA' }, { label: 'Ferrite', value: 'yes' }] },
  { id: 'i', name: 'Inf. Mic’s', category: 'cases', volume: true },
  { id: 'w', name: 'Schoeps wood box', nicknames: ['MINI CMIT'], category: 'other', type: 'wood box', inside: 'i' },
  { id: 'f', name: 'Schoeps mic', brand: 'Schoeps', category: 'other', type: 'mic', inside: 'i', details: [{ label: 'Windshield', value: 'fur' }] },
  { id: 'd', name: 'Exp. Drums', category: 'cables', qty: 3, volume: true },
] };

test('tree: what is in nothing on top; a case’s cases apart from its loose things', async () => {
  const { topItems, childrenOf, splitLoose } = await import('../src/gear-rules.js');
  assert.deepEqual(topItems(intMics).map(i => i.id), ['k', 'i', 'd']);
  const { boxes, loose } = splitLoose(intMics, childrenOf(intMics, 'i'));
  assert.deepEqual([boxes.map(i => i.id), loose.map(i => i.id)], [['w'], ['f']], 'a wood box is a case by its type');
});

test('search: by brand and details too; the tree keeps the cases a match is in', async () => {
  const { searchTree } = await import('../src/gear-rules.js');
  assert.deepEqual([...searchTree(intMics, 'fur').found], ['f']);
  assert.deepEqual([...searchTree(intMics, 'fur').shown].sort(), ['f', 'i']);
  assert.deepEqual([...searchTree(intMics, 'sma').found], ['b']);
  assert.deepEqual([...searchTree(intMics, 'schoeps').found].sort(), ['f', 'w']);
});

test('details: the type offers its usual fields and the ones other objects of that type use', async () => {
  const { fieldsOfType } = await import('../src/gear-rules.js');
  assert.deepEqual(fieldsOfType(intMics, 'Cable'), ['Connector A', 'Connector B', 'Length', 'Cable type', 'Colour', 'Ferrite']);
  assert.deepEqual(fieldsOfType(intMics, ''), []);
  assert.deepEqual(fieldsOfType(intMics, 'tripod'), []);
});

test('truck: volumes numbered one by one, Exp. Drums ×3 = 3 volumes', async () => {
  const { countVolumes } = await import('../src/gear-rules.js');
  const volumes = intMics.gearItems.filter(i => i.volume);
  const ticked = { ...intMics, gearChecks: { d: true } };
  assert.deepEqual(countVolumes(ticked, volumes), { numbers: { i: '1', d: '2–4' }, all: 4, loaded: 3 });
});

test('a type naming a case makes a case: Plastic case, soft case', async () => {
  const { isContainer } = await import('../src/gear-rules.js');
  assert.equal(isContainer(film, { id: 'x', category: 'other', type: 'Plastic case' }), true);
  assert.equal(isContainer(film, { id: 'y', category: 'other', type: 'soft case' }), true);
  assert.equal(isContainer(film, { id: 'z', category: 'other', type: 'mic' }), false);
});

test('↑ moves a case up among the cases next to it; loose things and other cases stay', async () => {
  const { moveUpAmongCases } = await import('../src/gear-rules.js');
  const project = { gearItems: [
    { id: 'a', name: 'Crate', type: 'Plastic case' },
    { id: 'b', name: 'TX case', type: 'hard case', inside: 'a' },
    { id: 'x', name: 'Scissors', inside: 'a' },
    { id: 'old', name: 'Gone case', type: 'soft case', inside: 'a', removed: '2026-10-01' },
    { id: 'c', name: 'Lavs case', type: 'soft case', inside: 'a' },
    { id: 'd', name: 'Other crate', type: 'Plastic case' },
  ] };
  assert.deepEqual(moveUpAmongCases(project, 'c').map(i => i.id), ['a', 'c', 'x', 'old', 'b', 'd']);
  assert.equal(moveUpAmongCases(project, 'b'), null); // already the first case in the crate
  assert.deepEqual(moveUpAmongCases(project, 'd').map(i => i.id), ['d', 'b', 'x', 'old', 'c', 'a']);
});
