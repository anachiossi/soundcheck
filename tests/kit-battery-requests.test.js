// kit-battery-requests.test.js — battery requests from the kit website (src/kit-battery-requests.js), through the same
// doors as the gear requests (src/kit-requests.js draftOf / changeOf / describe). The kit only grows. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftOf, changeOf, describe } from '../src/kit-requests.js';

const film = {
  gearItems: [],
  gearBatteries: {
    groups: [{ id: 'b2', name: 'NP-50 PRO · small TX', battery: 'NP-50', item: 'g453' }],
    batteries: [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ id: `b2-${n}`, group: 'b2', label: String(n) })),
  },
};
const at = '2026-11-01T10:00:00.000Z';

test('a battery change from the site: "10 in all" adds the 2 new ones, numbered after the last', () => {
  const request = { kind: 'battery', mode: 'edit', item: 'b2', count: '10', who: 'Davide', at };
  const draft = draftOf(film, request);
  assert.equal(draft.qty, 10);
  assert.deepEqual(changeOf(film, request, draft).battery, { id: 'b2', name: 'NP-50 PRO · small TX', battery: 'NP-50', add: 2, note: '' });
  assert.match(describe(film, request)[1], /8 → 10 \(2 new\)/);
});

test('fewer batteries than now deletes nothing: it is only a note', () => {
  const request = { kind: 'battery', mode: 'edit', item: 'b2', count: '6', notes: '2 swollen, thrown away', who: 'Davide', at };
  const change = changeOf(film, request, draftOf(film, request));
  assert.equal(change.battery.add, 0);
  assert.equal(change.battery.note, 'Davide, 2026-11-01: 2 swollen, thrown away');
  assert.match(describe(film, request)[1], /fewer: kept as a note/);
});

test('"Add batteries" in a group adds that many new ones', () => {
  const request = { kind: 'battery', mode: 'add', item: 'b2', count: '4', who: 'Angelo', at };
  assert.equal(changeOf(film, request, draftOf(film, request)).battery.add, 4);
  assert.equal(describe(film, request)[0], '+ 4 new batteries in NP-50 PRO · small TX (now 8)');
});

test('a new battery type needs a name, and keeps its battery model', () => {
  const request = { kind: 'battery', mode: 'add', item: '', name: 'NP-F970 · video', battery: 'NP-F970', count: '6', who: 'Angelo', at };
  const change = changeOf(film, request, draftOf(film, request)).battery;
  assert.deepEqual([change.id, change.name, change.battery, change.add], ['', 'NP-F970 · video', 'NP-F970', 6]);
  assert.ok(changeOf(film, { ...request, name: '' }, { ...draftOf(film, request), name: '' }).problem);
});

test('a battery group no longer in the list cannot be approved', () => {
  const request = { kind: 'battery', mode: 'add', item: 'b99', count: '2', at };
  assert.ok(changeOf(film, request, draftOf(film, request)).problem);
});
