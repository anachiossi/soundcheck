// kit-inbox.test.js — the kit website's inbox repo (src/kit-inbox.js): the waiting requests are read, a handled one
// leaves with its photos, and a photo is written as a binary file. Fake GitHub, made-up names. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeGitHub } from './fake-github.js';
import { inboxConnection, loadKitRequests, closeRequest, base64Of } from '../src/kit-inbox.js';
import { commitFiles } from '../src/store/github.js';

const connection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'k' };
const film = { settings: { kit_inbox: 'someone/kit-inbox' } };

test('a film with no inbox setting has no inbox', async () => {
  assert.equal(inboxConnection({ settings: {} }, connection), null);
  assert.deepEqual(await loadKitRequests({ settings: {} }, connection), { requests: [] });
});

test('the inbox uses Ana\'s key on the inbox repo', () => {
  assert.deepEqual(inboxConnection(film, connection), { ...connection, owner: 'someone', repo: 'kit-inbox', branch: 'main' });
});

test('the waiting requests are read with their photos, oldest first', async () => {
  fakeGitHub({ 'someone/kit-inbox': {
    'requests/r2/request.json': { id: 'r2', mode: 'add', name: 'Pole', who: 'Davide', at: '2026-10-29T10:00:00Z' },
    'requests/r2/photo-1.jpg': 'jpeg',
    'requests/r1/request.json': { id: 'r1', mode: 'edit', item: 'g3', notes: '14', who: 'Angelo', at: '2026-10-28T10:00:00Z' },
    'README.md': 'Kit inbox',
  } });
  const { requests } = await loadKitRequests(film, connection);
  assert.deepEqual(requests.map(r => [r.id, r.folder, Object.keys(r.photoShas)]),
    [['r1', 'requests/r1', []], ['r2', 'requests/r2', ['photo-1.jpg']]]);
});

test('a key that cannot see the inbox shows nothing and says so', async () => {
  fakeGitHub({});
  assert.deepEqual(await loadKitRequests(film, connection), { requests: [], cantRead: true });
});

test('a handled request leaves the inbox with all its photos, in one commit', async () => {
  let tree;
  fakeGitHub({ 'someone/kit-inbox': {
    'requests/r2/request.json': { id: 'r2' }, 'requests/r2/photo-1.jpg': 'jpeg', 'requests/r3/request.json': { id: 'r3' },
  } }, { onAsk: (url, options) => { if (url.endsWith('/git/trees') && options.method === 'POST') tree = JSON.parse(options.body).tree; } });
  await closeRequest(inboxConnection(film, connection), { id: 'r2', folder: 'requests/r2', who: 'Davide' }, 'approved');
  assert.deepEqual(tree.map(entry => [entry.path, entry.sha]).sort(), [['requests/r2/photo-1.jpg', null], ['requests/r2/request.json', null]]);
});

test('a photo is written as a binary file, text files as text', async () => {
  let tree;
  let blob;
  fakeGitHub({ 'someone/photos': {} }, { onAsk: (url, options) => {
    if (url.endsWith('/git/blobs') && options.method === 'POST') blob = JSON.parse(options.body);
    if (url.endsWith('/git/trees') && options.method === 'POST') tree = JSON.parse(options.body).tree;
  } });
  const photos = { ...connection, repo: 'photos' };
  await commitFiles(photos, { treeSha: 't', commitSha: 'c' }, { 'gear/a.jpg': { base64: base64Of(new Uint8Array([255, 216, 255])) }, 'x.txt': 'hi' }, 'm');
  assert.deepEqual(blob, { content: '/9j/', encoding: 'base64' });
  assert.deepEqual(tree, [{ path: 'gear/a.jpg', mode: '100644', type: 'blob', sha: 'b-new' },
    { path: 'x.txt', mode: '100644', type: 'blob', content: 'hi' }]);
});
