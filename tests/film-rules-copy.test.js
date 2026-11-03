// film-rules-copy.test.js — copying another film's rules (film-rules-copy.js → rulesToCopy). Made-up settings.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesToCopy } from '../src/film-rules-copy.js';

const other = {
  presets: { protagonist: '1', tx_order: ['1', '2'], lav_rules: { by_gender: { F: 'cos11', M: '6060' } } },
  commute: { ride_with: 'Someone Else', my_name: 'Me', walk_to_ride: 20, get_ready: 45, travel: 'maps' },
  workday: '8h', overtime: { double_after: 60 }, main_unit: 'SOMEONE', episodes: 'from_number', kit: 'k',
};

test('the chosen groups are copied, the other groups are not', () => {
  const { changes } = rulesToCopy(other, ['mics']);
  assert.deepEqual(Object.keys(changes), ['presets']);
  assert.deepEqual(changes.presets.lav_rules.by_gender, { F: 'cos11', M: '6060' });
});

test('the protagonist, the ride and my name on the call sheet are never copied', () => {
  const { changes, skipped } = rulesToCopy(other, ['mics', 'alarms']);
  assert.equal(changes.presets.protagonist, undefined);
  assert.equal(changes.commute.ride_with, undefined);
  assert.equal(changes.commute.my_name, undefined);
  assert.equal(changes.commute.walk_to_ride, 20);
  assert.deepEqual(skipped.sort(), ['commute.my_name', 'commute.ride_with', 'presets.protagonist']);
});

test("a film's own units, episodes and kit are never copied", () => {
  const { changes } = rulesToCopy(other, ['mics', 'day', 'alarms']);
  for (const key of ['main_unit', 'episodes', 'kit']) assert.equal(changes[key], undefined);
  assert.equal(changes.workday, '8h');
});

test('the other film keeps its own rules (a copy, not the same object)', () => {
  const { changes } = rulesToCopy(other, ['mics']);
  changes.presets.tx_order.push('3');
  assert.deepEqual(other.presets.tx_order, ['1', '2']);
});
