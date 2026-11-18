// robots-my-call.test.js — notifications per person and the robots following "My call":
//   • a phone's push/<phone>.json says whose phone it is (person, role) — parts/wrap-alerts.js
//   • Ana's "My call" is saved for the robots in settings.json commute "my_name" — hours-editing.js
// Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushEntry } from '../src/parts/wrap-alerts.js';
import { robotsMyNameAfter } from '../src/hours-editing.js';

const owner = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Office laptop' };
const crew = { ...owner, device: 'Davide', role: 'crew', name: 'Davide', folder: 'projects/test-film' };
const address = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } };
const commute = { meet_before_call: 45, travel_min: 75, travel_max: 90, get_ready: 45, sleep_hours: 8 };
const personal = name => ({ mode: 'personal', name });

// ---- whose phone ------------------------------------------------------------------

test('an owner phone saves its push file as role owner, with the device as the person', () => {
  const entry = pushEntry(address, owner, '2026-10-16T10:00:00Z');
  assert.equal(entry.role, 'owner');
  assert.equal(entry.person, 'Office laptop');
  assert.equal(entry.endpoint, address.endpoint);
  assert.equal(entry.saved_at, '2026-10-16T10:00:00Z');
});

test('a crew phone saves its push file as role crew, with the name of its link', () => {
  const entry = pushEntry(address, crew, '2026-10-16T10:00:00Z');
  assert.equal(entry.role, 'crew');
  assert.equal(entry.person, 'Davide');
});

// ---- My call for the robots -------------------------------------------------------

const film = (extra = {}) => ({ settings: { workday: '8h', commute: { ...commute, ...extra } } });

test('Ana picking a personal call saves her name for the robots', () => {
  assert.deepEqual(robotsMyNameAfter(film(), owner, personal(' Inês Rossi ')), { ...commute, my_name: 'Inês Rossi' });
});

test('Ana picking the general call removes the name for the robots', () => {
  assert.deepEqual(robotsMyNameAfter(film({ my_name: 'Inês Rossi' }), owner, { mode: 'general', name: 'Inês Rossi' }), commute);
});

test('nothing is saved when the robots already have the same choice', () => {
  assert.equal(robotsMyNameAfter(film({ my_name: 'Inês Rossi' }), owner, personal('Inês Rossi')), null);
  assert.equal(robotsMyNameAfter(film(), owner, { mode: 'general', name: '' }), null);
  assert.equal(robotsMyNameAfter(film(), owner, personal('  ')), null, 'personal with no name yet: general');
});

test('a crew phone never writes the name for the robots', () => {
  assert.equal(robotsMyNameAfter(film(), crew, personal('Davide')), null);
});

test('a film with no wake-up plan gets no commute just for the name', () => {
  assert.equal(robotsMyNameAfter({ settings: { workday: '8h' } }, owner, personal('Inês Rossi')), null);
});
