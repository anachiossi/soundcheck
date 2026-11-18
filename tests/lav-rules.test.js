// lav-rules.test.js — the editable mic rules (lav-rules.js) and the ODG's missing mics in the app (proposal-rules.js set_mics).
// Made-up film. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lavModels, readTxOrder, rulesWith, txModels } from '../src/lav-rules.js';
import { applyChange } from '../src/proposal-rules.js';

const project = {
  transmitters: [{ id: '1', model: 'A20' }, { id: '2', model: 'A20' }, { id: '10', model: 'SMV' }, { id: 'B1', model: 'ADX3' }],
  lavaliers: [{ id: '1', model: '6060' }, { id: '2', model: 'cos11' }, { id: '3', model: '6060' }],
};

test('the lav and TX models to choose from are the ones in the kit', () => {
  assert.deepEqual(lavModels(project), ['6060', 'cos11']);
  assert.deepEqual(txModels(project), ['A20', 'ADX3', 'SMV']);
});

test('the TX order keeps what was typed, in that order', () => {
  assert.deepEqual(readTxOrder('10, 1 2', project).order, ['10', '1', '2']);
});

test('a TX that is not in the kit is reported, never saved', () => {
  const read = readTxOrder('1, 99', project);
  assert.deepEqual(read.order, ['1']);
  assert.deepEqual(read.unknown, ['99']);
});

test('a boom typed in the TX order is reported and left out', () => {
  const read = readTxOrder('1, B1', project, ['B1']);
  assert.deepEqual(read.order, ['1']);
  assert.deepEqual(read.booms, ['B1']);
});

test('changing one lav rule keeps all the others', () => {
  const rules = { protagonist: '1', tx_order: ['1'], lav_rules: { loud: '6061', by_gender: { F: 'cos11' } } };
  assert.deepEqual(rulesWith(rules, { lav: { loud: '6060' } }), {
    protagonist: '1', tx_order: ['1'], same_tx_all_day: true, lav_rules: { loud: '6060', by_gender: { F: 'cos11' } } });
});

test('a rule set back to nothing leaves the file', () => {
  const rules = rulesWith({ protagonist: '1', wire_silent: 'recurring', lav_rules: { loud: '6061' } }, { wire_silent: '', lav: { loud: '' } });
  assert.deepEqual(rules, { protagonist: '1', same_tx_all_day: true });
});

const film = () => ({ presets: { 40: { scene_id: '40', rows: [
  { char_id: '1', tx_id: '5', lav_id: '9', speaker: 'yes' },
  { char_id: '2', tx_id: '', lav_id: '', speaker: 'yes' },
] } }, characters: [], transmitters: [], lavaliers: [], scenes: {}, settings: {} });

test('an ODG fills the empty mics of a scene and never changes a TX already chosen', () => {
  const op = { op: 'set_mics', scene_id: '40', mics: [{ char_id: '1', tx_id: '1', lav_id: '1' }, { char_id: '2', tx_id: '2', lav_id: '2' }] };
  const { film: changed, files } = applyChange(film(), op);
  assert.deepEqual(changed.presets[40].rows.map(row => [row.tx_id, row.lav_id]), [['5', '9'], ['2', '2']]);
  assert.equal(files.length, 1);
});

test('the mics of a scene that is gone change nothing', () => {
  assert.deepEqual(applyChange(film(), { op: 'set_mics', scene_id: '99', mics: [] }).files, []);
});
