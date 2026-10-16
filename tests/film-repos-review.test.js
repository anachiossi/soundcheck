// film-repos-review.test.js — one repo per film, the fixes after review (v158):
//   • opening another film during a sync never mixes the two films (sync-store.js)
//   • owner/repo names are the same whatever their capitals (GitHub ignores them)
//   • a backup file keeps the film's repo; films of the main repo keep following the main connection
//   • "Personal call" tapped with no name yet doesn't remove the name the robots know
//   • a failed look for films says "No signal: showing films on this device."
// GitHub is never called: fetch is replaced by a fake. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filmRepos, onDevice, sameRepo } from '../src/film-source.js';
import { readAllFilms, downloadFilm, loadFilmList, filmsNote } from '../src/films.js';
import { addFilmRepo } from '../src/film-repos.js';
import { syncNow } from '../src/sync.js';
import { getState, setState, importProjectFile } from '../src/state.js';
import { emptyProject } from '../src/store/repo-files.js';
import { robotsFollow } from '../src/my-call.js';
import { fakeGitHub, fakeDevice, forgetDevice, film } from './fake-github.js';

const main = { owner: 'someone', repo: 'all-films', branch: 'main', token: 'x', device: 'Office laptop' };
const withExtra = { ...main, repos: ['someone/film-x'] };
const filmX = { owner: 'someone', repo: 'film-x', branch: 'main' };
const idle = { running: false, error: null };
const commits = asked => asked.filter(url => url.endsWith('/git/commits'));

// Film A lives in the main repo (no source); film B in film-x. Each has a change waiting to upload.
function twoFilms() {
  const filmA = { ...emptyProject({ id: 'film-a', name: 'Film A' }, 'projects/film-a'),
    characters: [{ id: 'c1', name: 'Ines' }], outbox: { 'characters.json': { saved_at: '2026-10-16T10:00:00Z' } } };
  const filmB = { ...emptyProject({ id: 'film-b', name: 'Film B' }, 'projects/film-b'), source: filmX,
    presets: { 12: { scene: '12', rows: [{ character: 'Rui', tx: '3' }] } },
    outbox: { 'presets/12.json': { saved_at: '2026-10-16T11:00:00Z' } }, shas: { 'film.json': 'b-old' } };
  return { filmA, filmB };
}
const repos = {
  'someone/all-films': { 'projects/film-a/film.json': film('film-a', 'Film A') },
  'someone/film-x': { 'projects/film-b/film.json': film('film-b', 'Film B') },
};

test('opening another film between download and upload: nothing is committed, the other film is untouched', async () => {
  const { filmA, filmB } = twoFilms();
  const saved = [];
  // Ana opens film B right while film A's download is being saved
  fakeDevice({ onSave: project => {
    saved.push(project);
    if (project.id === 'film-a' && project.data_as_of) setState({ project: filmB });
  } });
  const asked = fakeGitHub(repos);
  setState({ connection: withExtra, projects: [], project: filmA, message: null, sync: idle });
  await syncNow({ loud: true });

  assert.deepEqual(commits(asked), [], 'no commit at all');
  assert.equal(getState().project, filmB, 'film B is open, exactly as it was (outbox, presets, fingerprints)');
  assert.deepEqual(getState().sync, idle, 'stopped quietly');
  assert.equal(getState().message, null, 'no message');
  assert.ok(!saved.some(project => project.id === 'film-b'), 'film B never saved by that sync');
  const filmASaved = saved.at(-1);
  assert.equal(filmASaved.id, 'film-a');
  assert.deepEqual(filmASaved.outbox, filmA.outbox, 'film A still has its change waiting');
  assert.deepEqual(filmASaved.characters, filmA.characters);

  // the next sync of film B talks to film B's own repo
  asked.length = 0;
  await syncNow();
  assert.equal(getState().sync.error, null);
  assert.deepEqual(commits(asked), ['https://api.github.com/repos/someone/film-x/git/commits']);
  assert.ok(asked.every(url => url.startsWith('https://api.github.com/repos/someone/film-x/')), asked.join('\n'));
  assert.deepEqual(getState().project.outbox, {}, 'film B uploaded');
  assert.equal(getState().project.id, 'film-b');
  forgetDevice();
});

test('opening another film during the download: the sync stops, nothing saved or uploaded', async () => {
  const { filmA, filmB } = twoFilms();
  const saved = [];
  fakeDevice({ onSave: project => saved.push(project) });
  const asked = fakeGitHub(repos, { onAsk: url => url.includes('/git/blobs/') && setState({ project: filmB }) });
  setState({ connection: withExtra, projects: [], project: filmA, message: null, sync: idle });
  await syncNow();
  assert.deepEqual(commits(asked), []);
  assert.deepEqual(saved, []);
  assert.equal(getState().project, filmB);
  forgetDevice();
});

test('owner/repo with other capitals is the same repo: adding it again does not duplicate films', async () => {
  fakeDevice();
  const owner = { ...main, owner: 'anachiossi', repo: 'soundcheck-data' };
  fakeGitHub({ 'anachiossi/soundcheck-data': { 'projects/a/film.json': film('a', 'A') }, 'AnaChiossi/Soundcheck-Data': {} });
  setState({ connection: owner, message: null });
  assert.equal(await addFilmRepo('AnaChiossi/Soundcheck-Data'), false);
  assert.match(getState().message.text, /already in the list/);
  assert.equal(getState().connection.repos, undefined);

  const stored = { ...owner, repos: ['AnaChiossi/Soundcheck-Data', 'Someone/Film-X', 'someone/film-x'] };
  assert.deepEqual(filmRepos(stored).map(repo => `${repo.owner}/${repo.repo}`), ['anachiossi/soundcheck-data', 'Someone/Film-X']);
  const films = await readAllFilms({ ...owner, repos: ['AnaChiossi/Soundcheck-Data'] }, []);
  assert.deepEqual(films.map(item => [item.id, item.clash]), [['a', undefined]], 'one film, no clash');
  assert.ok(sameRepo({ owner: 'Someone', repo: 'FILM-X' }, filmX));
  assert.equal(onDevice({ id: 'b', ...filmX }, [{ id: 'b', source: { owner: 'Someone', repo: 'Film-X', branch: 'main' } }], main), 'here');
  forgetDevice();
});

test('a backup file keeps the film\'s repo: from the file, or else from the film already on the device', async () => {
  const databases = fakeDevice();
  const backup = project => ({ text: async () => JSON.stringify(project) });
  const onDeviceFilm = { ...emptyProject({ id: 'film-x', name: 'Film X' }, 'projects/film-x'), source: filmX };
  databases['soundcheck:film-x'] = { data: onDeviceFilm };
  setState({ connection: withExtra, message: null });
  const { source, ...withoutSource } = onDeviceFilm;
  await importProjectFile(backup(withoutSource));
  assert.deepEqual(getState().project.source, filmX, 'kept from the device');

  const other = { owner: 'someone', repo: 'film-z', branch: 'main' };
  await importProjectFile(backup({ ...onDeviceFilm, source: other }));
  assert.deepEqual(getState().project.source, other, 'the file says where it lives');
  forgetDevice();
});

test('a film downloaded from the main repo keeps following the main connection (no source); an extra repo\'s film remembers its repo', async () => {
  fakeDevice();
  fakeGitHub({ ...repos, 'someone/all-films': { 'projects/old-film/film.json': film('old-film', 'Old Film') } });
  setState({ connection: withExtra, projects: [], project: null, message: null, sync: idle });
  await downloadFilm({ id: 'old-film', name: 'Old Film', folder: 'projects/old-film', owner: 'Someone', repo: 'All-Films', branch: 'main' });
  assert.equal(getState().project.source, undefined);
  await downloadFilm({ id: 'film-b', name: 'Film B', folder: 'projects/film-b', ...filmX });
  assert.deepEqual(getState().project.source, filmX);
  forgetDevice();
});

test('the robots follow General, and Personal only once a name is typed', () => {
  assert.equal(robotsFollow({ mode: 'general', name: '' }), true);
  assert.equal(robotsFollow({ mode: 'general', name: 'Ana' }), true);
  assert.equal(robotsFollow({ mode: 'personal', name: '' }), false, 'no name yet: the saved my_name stays');
  assert.equal(robotsFollow({ mode: 'personal', name: '   ' }), false);
  assert.equal(robotsFollow({ mode: 'personal', name: 'Ana Chiossi' }), true);
});

test('when the films can\'t be read, Projects says "No signal: showing films on this device." instead of looking forever', async () => {
  fakeDevice();
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ message: 'Server error' }) });
  setState({ connection: main, films: null, filmsFailed: false, message: null });
  assert.equal(filmsNote({ ...getState(), online: true }), 'Looking for films…');
  await loadFilmList();
  assert.equal(getState().filmsFailed, true);
  assert.equal(filmsNote({ ...getState(), online: true }), 'No signal: showing films on this device.');

  fakeGitHub({ 'someone/all-films': { 'projects/a/film.json': film('a', 'A') } });
  await loadFilmList();
  assert.equal(getState().filmsFailed, false, 'read again fine');
  assert.equal(getState().films.length, 1);
  forgetDevice();
});
