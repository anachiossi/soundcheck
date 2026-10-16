// crew.test.js — the crew link (crew-link.js) and reading a film by its folder (github.js).
// Uses made-up names and a fake key; GitHub is never called (fetch is replaced). Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCrewLink, readCrewLink, isCrew } from '../src/crew-link.js';
import { readFilm } from '../src/store/github.js';

const details = {
  owner: 'someone', repo: 'film-data', branch: 'main', token: 'github_pat_FAKE123',
  name: 'Davide', folder: 'projects/test-film', baseUrl: 'https://example.org/soundcheck/',
};

test('a crew link starts with the app address and #join=', () => {
  const link = makeCrewLink(details);
  assert.ok(link.startsWith('https://example.org/soundcheck/#join='));
});

test('the code in a crew link uses only letters that are safe in a link', () => {
  const code = makeCrewLink({ ...details, name: 'Inês ~?/+' }).split('#join=')[1];
  assert.match(code, /^[A-Za-z0-9_-]+$/);
});

test('reading a crew link gives back owner, repo, branch, key, name and folder', () => {
  const hash = '#' + makeCrewLink(details).split('#')[1];
  assert.deepEqual(readCrewLink(hash), {
    owner: 'someone', repo: 'film-data', branch: 'main', token: 'github_pat_FAKE123',
    name: 'Davide', folder: 'projects/test-film',
  });
});

test('a name with accents survives the link', () => {
  const hash = '#' + makeCrewLink({ ...details, name: 'Inês Conceição' }).split('#')[1];
  assert.equal(readCrewLink(hash).name, 'Inês Conceição');
});

test('a link made without a branch opens the main branch', () => {
  const hash = '#' + makeCrewLink({ ...details, branch: undefined }).split('#')[1];
  assert.equal(readCrewLink(hash).branch, 'main');
});

test('garbage, a cut-short link or another hash is not a crew link', () => {
  const hash = '#' + makeCrewLink(details).split('#')[1];
  assert.equal(readCrewLink(''), null);
  assert.equal(readCrewLink(undefined), null);
  assert.equal(readCrewLink('#hours'), null);
  assert.equal(readCrewLink('#join='), null);
  assert.equal(readCrewLink('#join=!!!not-a-code'), null);
  assert.equal(readCrewLink('#join=abc'), null);
  assert.equal(readCrewLink(hash.slice(0, hash.length - 12)), null);
});

test('a link without a key, a name or a folder is not a crew link', () => {
  for (const missing of ['token', 'name', 'folder']) {
    const hash = '#' + makeCrewLink({ ...details, [missing]: '' }).split('#')[1];
    assert.equal(readCrewLink(hash), null, `no ${missing}`);
  }
});

test('a link with a strange owner or repo name is refused', () => {
  const hash = '#' + makeCrewLink({ ...details, repo: '../../user' }).split('#')[1];
  assert.equal(readCrewLink(hash), null);
});

test('only a connection with role crew is a crew phone; Ana\'s devices have no role', () => {
  assert.equal(isCrew({ owner: 'someone', role: 'crew', name: 'Davide' }), true);
  assert.equal(isCrew({ owner: 'someone', device: 'Ana iPhone' }), false);
  assert.equal(isCrew(null), false);
});

// ---- github.js readFilm, with a fake GitHub ----

function fakeGitHub(answers) {
  const asked = [];
  globalThis.fetch = async url => {
    asked.push(url);
    const path = url.replace('https://api.github.com/repos/someone/film-data', '');
    const answer = answers(path);
    if (typeof answer === 'number') return { ok: false, status: answer };
    return { ok: true, status: 200, json: async () => answer };
  };
  return asked;
}

const asBlob = object => ({ content: Buffer.from(JSON.stringify(object)).toString('base64') });

test('a film is found by its folder: its id and name come from film.json, and it remembers its repo', async () => {
  const asked = fakeGitHub(path => {
    if (path === '/git/ref/heads/main') return { object: { sha: 'c1' } };
    if (path === '/git/commits/c1') return { tree: { sha: 't1' } };
    if (path.startsWith('/git/trees/t1')) return { tree: [{ type: 'blob', path: 'projects/test-film/film.json', sha: 'f1' }] };
    if (path === '/git/blobs/f1') return asBlob({ id: 'test-film', name: 'Test Film' });
    return 404;
  });
  const connection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', role: 'crew', name: 'Davide' };
  assert.deepEqual(await readFilm(connection, 'projects/test-film'), { id: 'test-film', name: 'Test Film', folder: 'projects/test-film',
    owner: 'someone', repo: 'film-data', branch: 'main' });
  assert.ok(asked.every(url => url.startsWith('https://api.github.com/repos/someone/film-data')), 'only reads');
});

test('an expired crew key gives status 401, so the phone can say crew access has ended', async () => {
  fakeGitHub(() => 401);
  const connection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'old', role: 'crew', name: 'Davide' };
  await assert.rejects(readFilm(connection, 'projects/test-film'), error => error.status === 401);
});

test('a folder with no film.json says the film is not there', async () => {
  fakeGitHub(path => {
    if (path === '/git/ref/heads/main') return { object: { sha: 'c1' } };
    if (path === '/git/commits/c1') return { tree: { sha: 't1' } };
    if (path.startsWith('/git/trees/t1')) return { tree: [] };
    return 404;
  });
  const connection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x' };
  await assert.rejects(readFilm(connection, 'projects/other'), /not in the repo/);
});
