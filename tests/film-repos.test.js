// film-repos.test.js — one private repo per film (film-source.js, films.js, film-repos.js, sync.js):
// Ana's one key reads films from several repos, each film remembers its repo, and everything that
// talks to GitHub about a film uses that repo. Films downloaded before this keep the main repo.
// GitHub is never called: fetch is replaced by a fake. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionFor, filmRepos, markClashes, readRepoName, onDevice } from '../src/film-source.js';
import { readAllFilms, downloadFilm } from '../src/films.js';
import { addFilmRepo, removeFilmRepo } from '../src/film-repos.js';
import { downloadCrewFilm } from '../src/crew-join.js';
import { syncNow } from '../src/sync.js';
import { getState, setState } from '../src/state.js';
import { fakeGitHub, fakeDevice, forgetDevice, film } from './fake-github.js';

const main = { owner: 'someone', repo: 'all-films', branch: 'main', token: 'x', device: 'Office laptop' };
const withExtra = { ...main, repos: ['someone/film-x'] };
const filmX = { owner: 'someone', repo: 'film-x', branch: 'main' };


test('a film with a source talks to its own repo, with the device\'s key, name and role', () => {
  const project = { id: 'film-x', source: filmX };
  assert.deepEqual(connectionFor(project, main), { ...main, owner: 'someone', repo: 'film-x', branch: 'main' });
  const crew = { ...main, role: 'crew', name: 'Davide' };
  assert.equal(connectionFor(project, crew).role, 'crew');
  assert.equal(connectionFor(project, crew).name, 'Davide');
});

test('a film downloaded before one repo per film (no source) uses the main connection, unchanged', () => {
  assert.equal(connectionFor({ id: 'old-film' }, main), main);
  assert.equal(connectionFor(null, main), main);
  assert.equal(connectionFor({ id: 'old-film' }, null), null);
});

test('films are read from the main repo first, then the extra repos; a device with no extra repos reads only the main one', () => {
  assert.deepEqual(filmRepos(main).map(repo => repo.repo), ['all-films']);
  assert.deepEqual(filmRepos({ ...withExtra, repos: ['someone/film-x', 'someone/all-films', 'not a repo'] }).map(repo => repo.repo),
    ['all-films', 'film-x']);
  assert.equal(readRepoName(' someone/film-x '). repo, 'film-x');
  assert.equal(readRepoName('film-x'), null);
});

test('the films list holds the films of two repos, each knowing where it lives', async () => {
  fakeGitHub({
    'someone/all-films': { 'projects/old-film/film.json': film('old-film', 'Old Film') },
    'someone/film-x': { 'projects/film-x/film.json': film('film-x', 'Film X') },
  });
  const films = await readAllFilms(withExtra, []);
  assert.deepEqual(films, [
    { id: 'film-x', name: 'Film X', folder: 'projects/film-x', owner: 'someone', repo: 'film-x', branch: 'main' },
    { id: 'old-film', name: 'Old Film', folder: 'projects/old-film', owner: 'someone', repo: 'all-films', branch: 'main' },
  ]);
});

test('two films with the same id in different repos are both shown with their repo, and the second is refused', async () => {
  fakeDevice();
  fakeGitHub({
    'someone/all-films': { 'projects/same/film.json': film('same', 'Same Film') },
    'someone/film-x': { 'projects/same/film.json': film('same', 'Same Film') },
  });
  const films = await readAllFilms(withExtra, []);
  assert.deepEqual(films.map(item => [item.repo, item.showRepo, item.clash]), [['all-films', true, false], ['film-x', true, true]]);
  setState({ connection: withExtra, projects: [], project: null, message: null });
  await downloadFilm(films[1]);
  assert.equal(getState().project, null, 'nothing downloaded');
  assert.match(getState().message.text, /same id \(same\).*someone\/film-x can't be downloaded/);
  forgetDevice();
});

test('the film already on the device keeps its id, even when its twin is in the main repo', () => {
  const films = [{ id: 'same', owner: 'someone', repo: 'all-films', branch: 'main' }, { id: 'same', ...filmX }];
  const marked = markClashes(films, [{ id: 'same', source: filmX }], main);
  assert.deepEqual(marked.map(item => item.clash), [true, false]);
  assert.equal(onDevice(films[1], [{ id: 'same', source: filmX }], main), 'here');
  assert.equal(onDevice(films[0], [{ id: 'same', source: filmX }], main), 'other');
  assert.equal(onDevice(films[0], [{ id: 'same' }], main), 'here', 'no source = the main repo');
});

test('a film downloaded from an extra repo remembers its repo, and its sync reads and uploads there', async () => {
  fakeDevice();
  const asked = fakeGitHub({ 'someone/film-x': { 'projects/film-x/film.json': film('film-x', 'Film X'), 'projects/film-x/characters.json': [] } });
  setState({ connection: withExtra, projects: [], project: null, message: null, sync: { running: false, error: null } });
  await downloadFilm({ id: 'film-x', name: 'Film X', folder: 'projects/film-x', ...filmX });
  assert.deepEqual(getState().project.source, filmX);

  // a change saved here is uploaded to the film's own repo
  asked.length = 0;
  setState({ project: { ...getState().project, characters: [{ id: 'c1', name: 'Ines' }],
    outbox: { 'characters.json': { saved_at: '2026-10-16T10:00:00Z' } } } });
  await syncNow();
  assert.equal(getState().sync.error, null);
  assert.ok(asked.includes('https://api.github.com/repos/someone/film-x/git/commits'), 'committed in film-x');
  assert.ok(asked.length > 0 && asked.every(url => url.startsWith('https://api.github.com/repos/someone/film-x/')), asked.join('\n'));
  forgetDevice();
});

test('a film without a source still syncs with the main repo, exactly as before', async () => {
  fakeDevice();
  const asked = fakeGitHub({ 'someone/all-films': { 'projects/old-film/film.json': film('old-film', 'Old Film') } });
  const old = { id: 'old-film', name: 'Old Film', folder: 'projects/old-film', presets: {}, schedule: [], shas: {}, outbox: {}, conflicts: {} };
  setState({ connection: withExtra, projects: [], project: old, sync: { running: false, error: null } });
  await syncNow();
  assert.equal(getState().sync.error, null);
  assert.ok(asked.some(url => url === 'https://api.github.com/repos/someone/all-films/git/ref/heads/main'));
  assert.ok(!asked.some(url => url.includes('/film-x/')));
  assert.equal(getState().project.source, undefined, 'nothing added to the old film');
  forgetDevice();
});

test('a crew link\'s film remembers the repo of the link', async () => {
  fakeDevice();
  fakeGitHub({ 'crew-owner/film-y': { 'projects/film-y/film.json': film('film-y', 'Film Y') } });
  const crew = { owner: 'crew-owner', repo: 'film-y', branch: 'main', token: 'crew', device: 'Davide', role: 'crew', name: 'Davide', folder: 'projects/film-y' };
  setState({ connection: crew, projects: [], project: null, message: null, sync: { running: false, error: null } });
  await downloadCrewFilm('projects/film-y');
  assert.deepEqual(getState().project.source, { owner: 'crew-owner', repo: 'film-y', branch: 'main' });
  forgetDevice();
});

test('adding a film repo checks the key can read it; one it can\'t read is not added', async () => {
  fakeDevice();
  fakeGitHub({ 'someone/film-x': {} });
  setState({ connection: main, message: null });
  assert.equal(await addFilmRepo('someone/secret'), false);
  assert.match(getState().message.text, /can't read someone\/secret/);
  assert.equal(getState().connection.repos, undefined);
  assert.equal(await addFilmRepo('not a repo'), false);
  assert.equal(await addFilmRepo('someone/film-x'), true);
  assert.deepEqual(getState().connection.repos, ['someone/film-x']);
  assert.equal(await addFilmRepo('someone/film-x'), false, 'already in the list');
  removeFilmRepo('someone/film-x');
  assert.deepEqual(getState().connection.repos, []);
  forgetDevice();
});
