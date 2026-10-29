// kit-files.test.js — a film that names its kit: the kit's files are read from and saved to kits/<kit>/, the film's
// own files stay in the film's folder (src/store/kit-files.js, used by sync.js). Fake GitHub, made-up names. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoPath, filmPaths, kitOf } from '../src/store/kit-files.js';
import { syncAsOwner } from '../src/sync.js';

const FOLDER = 'projects/test-film';
const withKit = { folder: FOLDER, settings: { kit: 'someone-kit' } };
const noKit = { folder: FOLDER, settings: {} };

test('a film with no kit keeps every file in its own folder, as before', () => {
  assert.equal(kitOf(noKit), '');
  assert.equal(repoPath(noKit, 'gear/items.json'), `${FOLDER}/gear/items.json`);
  assert.deepEqual(filmPaths(noKit, { [`${FOLDER}/gear/items.json`]: 'a', 'kits/someone-kit/gear/items.json': 'b' }), { 'gear/items.json': 'a' });
});

test('with a kit, the kit files are in kits/<kit>/ and the film keeps its own', () => {
  assert.equal(repoPath(withKit, 'gear/items.json'), 'kits/someone-kit/gear/items.json');
  assert.equal(repoPath(withKit, 'transmitters.json'), 'kits/someone-kit/transmitters.json');
  assert.equal(repoPath(withKit, 'ifb/receivers.json'), 'kits/someone-kit/ifb/receivers.json');
  assert.equal(repoPath(withKit, 'docs/manuals/Shure/ADX3.pdf'), 'kits/someone-kit/docs/manuals/Shure/ADX3.pdf');
  assert.equal(repoPath(withKit, 'gear/checks.json'), `${FOLDER}/gear/checks.json`, 'the ticks are the film\'s');
  assert.equal(repoPath(withKit, 'ifb/list.json'), `${FOLDER}/ifb/list.json`, 'who has which receiver is the film\'s');
  assert.equal(repoPath(withKit, 'schedule.json'), `${FOLDER}/schedule.json`);
});

test('with a kit, old copies of kit files in the film folder are ignored, other kits too', () => {
  const found = filmPaths(withKit, {
    [`${FOLDER}/gear/items.json`]: 'old', [`${FOLDER}/gear/checks.json`]: 'ticks', [`${FOLDER}/schedule.json`]: 's',
    'kits/someone-kit/gear/items.json': 'kit', 'kits/someone-kit/README.md': 'r', 'kits/other-kit/gear/items.json': 'other',
  });
  assert.deepEqual(found, { 'gear/items.json': 'kit', 'gear/checks.json': 'ticks', 'schedule.json': 's' });
});

// a fake GitHub holding one film with a kit; the commit's tree is kept to see where each file went
function fakeRepo(files) {
  const sent = {};
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = url.replace('https://api.github.com/repos/someone/film-data', '');
    const answer = value => ({ ok: true, status: 200, json: async () => value });
    if (path === '/git/ref/heads/main') return answer({ object: { sha: 'c1' } });
    if (path === '/git/commits/c1') return answer({ tree: { sha: 't1' } });
    if (path.startsWith('/git/trees/t1')) return answer({ tree: Object.keys(files).map(file => ({ type: 'blob', path: file, sha: file })) });
    if (path.startsWith('/git/blobs/')) return answer({ content: Buffer.from(JSON.stringify(files[decodeURIComponent(path.slice(11))])).toString('base64') });
    if (method === 'POST' && path === '/git/trees') { sent.tree = JSON.parse(options.body).tree; return answer({ sha: 't2' }); }
    if (method === 'POST' && path === '/git/commits') return answer({ sha: 'c2' });
    if (method === 'PATCH') return answer({});
    if (path.startsWith('/issues')) return answer([]);
    return { ok: false, status: 404 };
  };
  return sent;
}

test('sync: the film reads its kit\'s gear list, and an edit is saved back into the kit', async () => {
  const sent = fakeRepo({
    [`${FOLDER}/film.json`]: { id: 'test-film', name: 'Test' },
    [`${FOLDER}/settings.json`]: { kit: 'someone-kit' },
    [`${FOLDER}/gear/items.json`]: [{ id: 'g1', name: 'OLD COPY' }],
    'kits/someone-kit/gear/items.json': [{ id: 'g1', name: 'Boom pole' }],
  });
  const store = { project: { id: 'test-film', folder: FOLDER, presets: {}, schedule: [], settings: {}, shas: {}, outbox: {}, conflicts: {} } };
  store.read = () => store.project;
  store.save = async next => { store.project = next; };
  await syncAsOwner({ owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Test' }, store);
  assert.deepEqual(store.project.gearItems, [{ id: 'g1', name: 'Boom pole' }], 'the kit, not the old copy (read even on the first sync)');

  store.project = { ...store.project, gearItems: [{ id: 'g1', name: 'Boom pole' }, { id: 'g2', name: 'Sandbag' }],
    gearChecks: { g1: true }, outbox: { 'gear/items.json': { saved_at: 'x' }, 'gear/checks.json': { saved_at: 'x' } } };
  await syncAsOwner({ owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Test' }, store);
  assert.deepEqual(sent.tree.map(entry => entry.path).sort(), ['kits/someone-kit/gear/items.json', `${FOLDER}/gear/checks.json`]);
});
