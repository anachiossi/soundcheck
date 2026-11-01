// film-close.test.js — Close film on this device (film-close.js, store/local.js): the film's copy on the
// device goes, the data repo is never touched, and a film with changes only on this device never closes.
// GitHub is never called: fetch is replaced by a fake that remembers every call. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeFilm, whyNotClose } from '../src/film-close.js';
import { saveProject, listProjects } from '../src/store/local.js';
import { getState, setState } from '../src/state.js';
import { fakeGitHub, fakeDevice, forgetDevice } from './fake-github.js';

const filmA = { id: 'film-a', name: 'Film A', outbox: {}, conflicts: {}, data_as_of: '2026-10-30T18:00:00Z' };
const filmB = { id: 'film-b', name: 'Film B', outbox: {}, conflicts: {}, data_as_of: '2026-11-01T18:00:00Z' };

test('closing a film deletes only its copy on this device and never calls GitHub', async () => {
  const databases = fakeDevice();
  const asked = fakeGitHub({});
  await saveProject(filmA);
  await saveProject(filmB);
  setState({ project: filmB, projects: listProjects(), sync: { running: false, error: null } });

  await closeFilm('film-a');

  assert.equal(databases['soundcheck:film-a'], undefined);
  assert.ok(databases['soundcheck:film-b']);
  assert.deepEqual(listProjects().map(film => film.id), ['film-b']);
  assert.deepEqual(getState().projects.map(film => film.id), ['film-b']);
  assert.equal(getState().project.id, 'film-b'); // the open film stays open
  assert.deepEqual(asked, []);
  forgetDevice();
});

test('closing the open film goes back to Projects with no film open', async () => {
  fakeDevice();
  fakeGitHub({});
  await saveProject(filmA);
  setState({ project: filmA, projects: listProjects(), screen: 'schedule', sync: { running: false, error: null } });

  await closeFilm('film-a');

  assert.equal(getState().project, null);
  assert.equal(getState().screen, 'projects');
  assert.match(getState().message.text, /closed on this device/);
  forgetDevice();
});

test('a film with changes not uploaded yet is never closed', async () => {
  const databases = fakeDevice();
  fakeGitHub({});
  const waiting = { ...filmA, outbox: { 'presets/53.json': { saved_at: '2026-11-01T10:00:00Z' } } };
  await saveProject(waiting);
  setState({ project: waiting, projects: listProjects(), sync: { running: false, error: null } });

  await closeFilm('film-a');

  assert.ok(databases['soundcheck:film-a']);
  assert.equal(getState().project.id, 'film-a');
  assert.match(getState().message.text, /sync first/);
  forgetDevice();
});

test('a film with changes made on two devices, or still syncing, is never closed', () => {
  assert.match(whyNotClose({ ...filmA, conflicts: { 'presets/53.json': {} } }), /two devices/);
  assert.match(whyNotClose(filmA, { syncing: true }), /syncing/);
  assert.equal(whyNotClose(filmA), '');
});
