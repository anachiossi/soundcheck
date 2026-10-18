// lav-acc.test.js — the lav's mount or plush sleeve, from the scene (src/lav-acc-rules.js, Ana 18 Oct).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLavAccessories, lavAccessoryFor, withLavAccessory } from '../src/lav-acc-rules.js';
import { applyChange } from '../src/proposal-rules.js';
import { accLabel } from '../src/accessories.js';

const project = {
  lavaliers: [{ id: '1', color: '#000000' }, { id: '2', color: '#FAF1D9' }, { id: '3', color: '#ff0000' }],
  scenes: { 10: { int_ext: 'INT' }, 11: { int_ext: 'EXT' }, 12: { int_ext: 'INT/EXT' } },
  presets: {},
  settings: { presets: { lav_accessories: [
    { scenes: ['INT', 'INT/EXT'], lav_colour: '#000000', gear: 'mount-black' },
    { scenes: ['INT', 'INT/EXT'], lav_colour: '#faf1d9', gear: 'mount-beige' },
    { scenes: ['EXT'], lav_colour: '#000000', gear: 'sleeve-black' },
  ] } },
};

test('an interior or int/ext scene gets a mini mount the colour of the lav', () => {
  assert.equal(lavAccessoryFor(project, '10', '1'), 'mount-black');
  assert.equal(lavAccessoryFor(project, '10', '2'), 'mount-beige', 'colours match ignoring capitals');
  assert.equal(lavAccessoryFor(project, '12', '1'), 'mount-black');
});

test('an exterior scene gets the plush sleeve the colour of the lav', () => {
  assert.equal(lavAccessoryFor(project, '11', '1'), 'sleeve-black');
});

test('no lav, or a colour with no rule, gets nothing', () => {
  assert.equal(lavAccessoryFor(project, '10', ''), '');
  assert.equal(lavAccessoryFor(project, '10', '3'), '');
});

test('the strap stays and a mount that no longer fits is swapped', () => {
  const row = { char_id: '1', lav_id: '1', acc: ['strap', 'mount-black'] };
  assert.deepEqual(withLavAccessory(project, '11', row).acc, ['strap', 'sleeve-black']);
  assert.deepEqual(withLavAccessory(project, '10', { ...row, lav_id: '' }).acc, ['strap'], 'no lav, no mount');
});

test('a row whose lav did not change keeps what Ana left, a new lav gets its mount', () => {
  const saved = [{ char_id: '1', lav_id: '1', acc: ['strap'] }, { char_id: '2', lav_id: '1' }];
  const rows = [{ char_id: '1', lav_id: '1', acc: ['strap'] }, { char_id: '2', lav_id: '2' }, { char_id: '3', lav_id: '1' }];
  const after = applyLavAccessories(project, '10', rows, saved);
  assert.deepEqual(after[0].acc, ['strap'], 'mount taken off by hand stays off');
  assert.deepEqual(after[1].acc, ['mount-beige']);
  assert.deepEqual(after[2].acc, ['mount-black']);
});

test('a film with no rules keeps its rows as they are', () => {
  const row = { char_id: '1', lav_id: '1' };
  assert.equal(withLavAccessory({ ...project, settings: {} }, '10', row), row);
});

test('the pills say Mini mount and Plush sleeve', () => {
  assert.equal(accLabel({ name: 'Mini mount beige', type: 'mini mount' }), 'Mini mount');
  assert.equal(accLabel({ name: 'Ursa plush sleeve black', type: 'plush sleeve' }), 'Plush sleeve');
});

test('a preset review gives every lav its mount', () => {
  const film = { ...project, presets: {} };
  const { film: after } = applyChange(film, { op: 'set_preset', scene_id: '11', rows: [{ char_id: '1', tx_id: '3', lav_id: '1', speaker: 'yes' }] });
  assert.deepEqual(after.presets['11'].rows[0].acc, ['sleeve-black']);
});
