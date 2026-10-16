// crew-changes.test.js — a crew person's changes as a suggestion (crew-changes.js, crew-describe.js):
// what changed in a file, applying it to the film's current data, the lines for people, and the
// suggestion's GitHub issue read back. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changesBetween, applyChanges, describeChanges, suggestionIssue, readSuggestion, readDecision } from '../src/crew-changes.js';

const sandbag = { id: 'g3', name: 'Sandbag', category: 'grip', qty: 4 };
const umbrella = { id: 'g1', name: 'Umbrella top', category: 'grip', qty: 1, note: '' };
const cable = { id: 'g2', name: 'XLR cable', category: 'cables', qty: 10 };

// ---- changesBetween --------------------------------------------------------------

test('a list with ids gives one change per changed record, and nothing for unchanged ones', () => {
  const base = [umbrella, cable];
  const mine = [{ ...umbrella, note: 'broken rib' }, cable, sandbag];
  assert.deepEqual(changesBetween('gear/items.json', base, mine), [
    { op: 'set', id: 'g1', value: { ...umbrella, note: 'broken rib' } },
    { op: 'set', id: 'g3', value: sandbag },
  ]);
});

test('a record taken out of a list is a remove change', () => {
  assert.deepEqual(changesBetween('gear/items.json', [umbrella, cable], [cable]), [{ op: 'remove', id: 'g1' }]);
});

test('the same record with its fields in another order is not a change', () => {
  const shuffled = { qty: 10, category: 'cables', name: 'XLR cable', id: 'g2' };
  assert.deepEqual(changesBetween('gear/items.json', [cable], [shuffled]), []);
});

test('the schedule is compared scene by scene (scene_id)', () => {
  const base = [{ scene_id: '12', day: 3, order: 1 }, { scene_id: '13', day: 3, order: 2 }];
  const mine = [{ scene_id: '12', day: 4, order: 1 }, { scene_id: '13', day: 3, order: 2 }];
  assert.deepEqual(changesBetween('schedule.json', base, mine), [{ op: 'set', id: '12', value: mine[0] }]);
});

test('an object file (scenes.json, a preset) is compared key by key', () => {
  const base = { 12: { set: 'Kitchen' }, 13: { set: 'Garden' }, 14: { set: 'Car' } };
  const mine = { 12: { set: 'Kitchen' }, 13: { set: 'Garden at night' }, 15: { set: 'Roof' } };
  assert.deepEqual(changesBetween('scenes.json', base, mine), [
    { op: 'set', key: '13', value: { set: 'Garden at night' } },
    { op: 'set', key: '15', value: { set: 'Roof' } },
    { op: 'remove', key: '14' },
  ]);
});

test('a file the film did not have yet is sent whole (replace)', () => {
  const preset = { scene_id: '12', rows: [] };
  assert.deepEqual(changesBetween('presets/12.json', null, preset), [{ op: 'replace', value: preset }]);
  assert.deepEqual(changesBetween('presets/12.json', undefined, preset), [{ op: 'replace', value: preset }]);
});

test('a list without ids (or with an id twice) is sent whole', () => {
  assert.deepEqual(changesBetween('gear/history.json', [{ at: 'a' }], [{ at: 'b' }]), [{ op: 'replace', value: [{ at: 'b' }] }]);
  const twice = [{ scene_id: '12', day: 3 }, { scene_id: '12', day: 4 }];
  assert.deepEqual(changesBetween('schedule.json', twice, [twice[0]]), [{ op: 'replace', value: [twice[0]] }]);
});

test('an unchanged file gives no changes at all', () => {
  assert.deepEqual(changesBetween('gear/items.json', [umbrella], [umbrella]), []);
  assert.deepEqual(changesBetween('scenes.json', { 12: {} }, { 12: {} }), []);
  assert.deepEqual(changesBetween('gear/history.json', [{ at: 'a' }], [{ at: 'a' }]), []);
});

// ---- applyChanges ----------------------------------------------------------------

test('changes are applied to the film as it is NOW: other people\'s later edits are kept', () => {
  const base = [umbrella, cable];
  const current = [umbrella, { ...cable, qty: 12 }];          // Ana changed the cables meanwhile
  const changes = [{ op: 'set', id: 'g1', value: { ...umbrella, note: 'broken rib' } }, { op: 'set', id: 'g3', value: sandbag }];
  const { content, clashes } = applyChanges('gear/items.json', current, changes, base);
  assert.deepEqual(content, [{ ...umbrella, note: 'broken rib' }, { ...cable, qty: 12 }, sandbag]);
  assert.deepEqual(clashes, []);
});

test('a record changed by someone else meanwhile is a clash (the suggestion still applies)', () => {
  const base = [umbrella];
  const current = [{ ...umbrella, qty: 2 }];
  const change = { op: 'set', id: 'g1', value: { ...umbrella, note: 'broken rib' } };
  const { content, clashes } = applyChanges('gear/items.json', current, [change], base);
  assert.deepEqual(clashes, [change]);
  assert.deepEqual(content, [change.value]);
});

test('removing a record someone changed meanwhile is a clash too', () => {
  const change = { op: 'remove', id: 'g1' };
  const result = applyChanges('gear/items.json', [{ ...umbrella, qty: 2 }, cable], [change], [umbrella, cable]);
  assert.deepEqual(result.content, [cable]);
  assert.deepEqual(result.clashes, [change]);
});

test('the same change made by someone else meanwhile is not a clash', () => {
  const value = { ...umbrella, note: 'broken rib' };
  const result = applyChanges('gear/items.json', [value], [{ op: 'set', id: 'g1', value }], [umbrella]);
  assert.deepEqual(result.clashes, []);
});

test('the schedule is applied by scene_id', () => {
  const base = [{ scene_id: '12', day: 3 }, { scene_id: '13', day: 3 }];
  const current = [{ scene_id: '13', day: 3 }, { scene_id: '12', day: 3 }];
  const { content } = applyChanges('schedule.json', current, [{ op: 'set', id: '12', value: { scene_id: '12', day: 5 } }], base);
  assert.deepEqual(content, [{ scene_id: '13', day: 3 }, { scene_id: '12', day: 5 }]);
});

test('object files are applied key by key, with clashes per key', () => {
  const base = { 12: { set: 'Kitchen' }, 13: { set: 'Garden' } };
  const current = { 12: { set: 'Kitchen (night)' }, 13: { set: 'Garden' }, 20: { set: 'New' } };
  const changes = [{ op: 'set', key: '13', value: { set: 'Garden at night' } }, { op: 'remove', key: '12' }];
  const { content, clashes } = applyChanges('scenes.json', current, changes, base);
  assert.deepEqual(content, { 13: { set: 'Garden at night' }, 20: { set: 'New' } });
  assert.deepEqual(clashes, [changes[1]]);
});

test('a whole-file change clashes only when the film\'s file changed meanwhile', () => {
  const change = { op: 'replace', value: [{ at: 'b' }] };
  assert.deepEqual(applyChanges('gear/history.json', [{ at: 'a' }], [change], [{ at: 'a' }]).clashes, []);
  assert.deepEqual(applyChanges('gear/history.json', [{ at: 'z' }], [change], [{ at: 'a' }]).clashes, [change]);
  assert.deepEqual(applyChanges('presets/12.json', undefined, [change], null), { content: change.value, clashes: [] });
});

// ---- describeChanges -------------------------------------------------------------

test('a preset is described as one line for its scene', () => {
  const changes = [{ op: 'set', key: 'rows', value: [] }];
  assert.deepEqual(describeChanges('presets/12.json', changes, {}), ['Scene 12: preset changed']);
});

test('gear lines say what was added, removed or changed, by name', () => {
  const base = [umbrella, cable];
  const changes = changesBetween('gear/items.json', base, [{ ...umbrella, note: 'broken rib' }, sandbag]);
  assert.deepEqual(describeChanges('gear/items.json', changes, {}, base), [
    'Gear: Umbrella top — note changed', 'Gear: + Sandbag', 'Gear: − XLR cable',
  ]);
});

test('a character\'s lav fields are described as "lav"', () => {
  const ines = { id: '3', name: 'Ines', pref_lav_model: 'DPA 4060', pref_lav_color: 'black' };
  const project = { characters: [ines] };
  const changes = [{ op: 'set', id: '3', value: { ...ines, pref_lav_model: 'DPA 6060', pref_lav_color: 'beige' } }];
  assert.deepEqual(describeChanges('characters.json', changes, project), ['Characters: Ines — lav changed']);
});

test('kit records are named by model and colour; schedule and scenes by scene number', () => {
  const lav = { id: '17', model: 'DPA 4060', color: 'beige', connector: 'TA4' };
  assert.deepEqual(describeChanges('lavaliers.json', [{ op: 'set', id: '17', value: lav }], {}, []), ['Lavs: + DPA 4060 beige']);
  const schedule = [{ scene_id: '12', day: 3 }];
  assert.deepEqual(describeChanges('schedule.json', [{ op: 'set', id: '12', value: { scene_id: '12', day: 4 } }], {}, schedule),
    ['Schedule: scene 12 — day changed']);
  assert.deepEqual(describeChanges('scenes.json', [{ op: 'set', key: '12', value: { notes: 'rain' } }], {}, { 12: { notes: '' } }),
    ['Scenes: scene 12 — notes changed']);
});

test('a file with no name for people falls back to "<file> changed"', () => {
  assert.deepEqual(describeChanges('odd/thing.json', [{ op: 'replace', value: 1 }], {}), ['odd/thing changed']);
  assert.deepEqual(describeChanges('gear/items.json', [], {}), ['Gear changed']);
});

// ---- the issue -------------------------------------------------------------------

const details = { by: 'Davide', film: 'projects/test-film', path: 'gear/items.json', base_sha: 'abc123',
  changes: [{ op: 'set', id: 'g3', value: sandbag }], saved_at: '2026-10-16T10:00:00.000Z' };

test('a suggestion issue is titled with the name and the first line, and labelled crew-proposal', () => {
  const issue = suggestionIssue(details, ['Gear: + Sandbag']);
  assert.equal(issue.title, 'Suggestion from Davide: Gear: + Sandbag');
  assert.deepEqual(issue.labels, ['crew-proposal']);
  assert.match(issue.body, /^- Gear: \+ Sandbag\n/);
  assert.match(issue.body, /"soundcheck": "crew-suggestion"/);
});

test('a suggestion issue reads back with everything needed to apply it (labels not needed)', () => {
  const { body } = suggestionIssue(details, ['Gear: + Sandbag']);
  const read = readSuggestion({ number: 7, state: 'open', body, labels: [] });
  assert.deepEqual(read, { number: 7, state: 'open', ...details, lines: ['Gear: + Sandbag'] });
});

test('other issues, broken JSON or another marker are not suggestions', () => {
  assert.equal(readSuggestion(null), null);
  assert.equal(readSuggestion({ number: 1, body: null }), null);
  assert.equal(readSuggestion({ number: 1, body: 'The truck has a flat tyre' }), null);
  assert.equal(readSuggestion({ number: 1, body: '```json\n{ not json\n```' }), null);
  assert.equal(readSuggestion({ number: 1, body: '```json\n{"soundcheck":"crew-feedback","version":1}\n```' }), null);
  assert.equal(readSuggestion({ number: 1, body: '```json\n{"soundcheck":"crew-suggestion","version":1,"path":"x.json"}\n```' }), null);
});

test('the closing comment says approved, not approved (with a reason) or just closed', () => {
  assert.deepEqual(readDecision('approved'), { state: 'approved', reason: '' });
  assert.deepEqual(readDecision('Approved, thanks'), { state: 'approved', reason: '' });
  assert.deepEqual(readDecision('not approved: wrong scene'), { state: 'not approved', reason: 'wrong scene' });
  assert.deepEqual(readDecision('Not approved'), { state: 'not approved', reason: '' });
  assert.deepEqual(readDecision('Replaced by #9'), { state: 'closed', reason: '' });
  assert.deepEqual(readDecision(undefined), { state: 'closed', reason: '' });
});
