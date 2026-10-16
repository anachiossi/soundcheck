// crew-sync.test.js — syncing on a crew phone (crew-sync.js): changes are sent as suggestions
// (GitHub issues), never commits; a closed suggestion gives the film's version back.
// GitHub is never called: fetch is replaced by a fake. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendSuggestions, takeBackClosed, noteBases, keepProposed, proposedPaths, DOWNLOAD_AGAIN } from '../src/crew-sync.js';
import { suggestionIssue, readSuggestion } from '../src/crew-changes.js';
import { applyRemote, filesToDownload } from '../src/store/repo-files.js';

const connection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Davide', role: 'crew', name: 'Davide', folder: 'projects/test-film' };
const PATH = 'gear/items.json';
const SAVED = '2026-10-16T10:00:00.000Z';
const umbrella = { id: 'g1', name: 'Umbrella top', qty: 1 };
const sandbag = { id: 'g3', name: 'Sandbag', qty: 4 };

// A fake GitHub: answers(method, path, body) → an answer, or a number = an error status.
function fakeGitHub(answers) {
  const asked = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = url.replace('https://api.github.com/repos/someone/film-data', '');
    const body = options.body ? JSON.parse(options.body) : null;
    asked.push({ method, path, body });
    const answer = answers(method, path, body);
    if (typeof answer === 'number') return { ok: false, status: answer };
    return { ok: true, status: 200, json: async () => answer };
  };
  return asked;
}

const asBlob = object => ({ content: Buffer.from(JSON.stringify(object)).toString('base64') });

// The film on the phone: Davide added a sandbag to the gear list.
function crewProject(extra = {}) {
  return {
    id: 'test-film', name: 'Test Film', folder: 'projects/test-film', presets: {},
    gearItems: [umbrella, sandbag], shas: { [PATH]: 'sha-base' },
    outbox: { [PATH]: { saved_at: SAVED } }, conflicts: {}, ...extra,
  };
}

function memoryStore(project) {
  const store = { project, read: () => store.project, save: async next => { store.project = next; } };
  return store;
}

const writesToFiles = asked => asked.filter(call => call.method !== 'GET' && call.path.startsWith('/git/'));

test('sending creates one suggestion issue with the marker, and never writes a file', async () => {
  const asked = fakeGitHub((method, path) => {
    if (method === 'GET' && path === '/git/blobs/sha-base') return asBlob([umbrella]);
    if (method === 'POST' && path === '/issues') return { number: 8 };
    return 404;
  });
  const store = memoryStore(crewProject());
  assert.equal(await sendSuggestions(connection, store), 1);

  const created = asked.filter(call => call.method === 'POST' && call.path === '/issues');
  assert.equal(created.length, 1);
  assert.equal(created[0].body.title, 'Suggestion from Davide: Gear: + Sandbag');
  const suggestion = readSuggestion({ number: 8, state: 'open', body: created[0].body.body });
  assert.equal(suggestion.by, 'Davide');
  assert.equal(suggestion.film, 'projects/test-film');
  assert.equal(suggestion.base_sha, 'sha-base');
  assert.deepEqual(suggestion.changes, [{ op: 'set', id: 'g3', value: sandbag }]);
  assert.deepEqual(writesToFiles(asked), []);

  assert.deepEqual(store.project.crewSuggestions.sent, { [PATH]: { issue: 8, saved_at: SAVED } });
  assert.deepEqual(store.project.outbox, { [PATH]: { saved_at: SAVED } }, 'the change stays on the phone');
  assert.deepEqual(proposedPaths(store.project), [PATH]);
});

test('a file already sent and not changed again is not sent twice', async () => {
  const asked = fakeGitHub(() => 404);
  const store = memoryStore(crewProject({ crewSuggestions: { base: { [PATH]: 'sha-base' }, sent: { [PATH]: { issue: 8, saved_at: SAVED } }, log: [] } }));
  assert.equal(await sendSuggestions(connection, store), 0);
  assert.deepEqual(asked, []);
});

test('a file changed again replaces its older suggestion, which is closed', async () => {
  const asked = fakeGitHub((method, path) => {
    if (path === '/git/blobs/sha-base') return asBlob([umbrella]);
    if (method === 'POST' && path === '/issues') return { number: 9 };
    if (method === 'POST' && path === '/issues/8/comments') return {};
    if (method === 'PATCH' && path === '/issues/8') return {};
    return 404;
  });
  const later = '2026-10-16T11:00:00.000Z';
  const store = memoryStore(crewProject({ outbox: { [PATH]: { saved_at: later } },
    crewSuggestions: { base: { [PATH]: 'sha-base' }, sent: { [PATH]: { issue: 8, saved_at: SAVED } }, log: [] } }));
  assert.equal(await sendSuggestions(connection, store), 1);
  assert.deepEqual(asked.find(call => call.path === '/issues/8/comments').body, { body: 'Replaced by #9' });
  assert.equal(asked.find(call => call.path === '/issues/8').body.state, 'closed');
  assert.deepEqual(store.project.crewSuggestions.sent[PATH], { issue: 9, saved_at: later });
  assert.deepEqual(store.project.crewSuggestions.log, [], 'a replaced suggestion is not a decision');
});

test('a file changed back to the film\'s version sends nothing and leaves the outbox', async () => {
  const asked = fakeGitHub((method, path) => (path === '/git/blobs/sha-base' ? asBlob([umbrella, sandbag]) : 404));
  const store = memoryStore(crewProject());
  assert.equal(await sendSuggestions(connection, store), 0);
  assert.equal(asked.filter(call => call.method !== 'GET').length, 0);
  assert.deepEqual(store.project.outbox, {});
});

// The suggestion #8 as it is on GitHub, closed.
function closedIssue(number, by = 'Davide') {
  const details = { by, film: 'projects/test-film', path: PATH, base_sha: 'sha-base',
    changes: [{ op: 'set', id: 'g3', value: sandbag }], saved_at: SAVED };
  return { number, state: 'closed', ...suggestionIssue(details, ['Gear: + Sandbag']) };
}

test('a closed approved suggestion leaves the outbox, is logged approved, and the film\'s version comes back', async () => {
  fakeGitHub((method, path) => {
    if (path.startsWith('/issues?')) return [closedIssue(8), { number: 5, state: 'closed', body: 'The truck is late' }, { number: 6, pull_request: {} }];
    if (path.startsWith('/issues/8/comments?')) return [{ body: 'approved' }];
    return 404;
  });
  const store = memoryStore(crewProject({ crewSuggestions: { base: { [PATH]: 'sha-base' }, sent: { [PATH]: { issue: 8, saved_at: SAVED } }, log: [] } }));
  assert.equal(await takeBackClosed(connection, store), 1);
  const project = store.project;
  assert.deepEqual(project.outbox, {});
  assert.deepEqual(project.crewSuggestions.sent, {});
  assert.deepEqual(project.crewSuggestions.base, {});
  assert.equal(project.crewSuggestions.log.length, 1);
  assert.deepEqual({ ...project.crewSuggestions.log[0], at: 'x' },
    { issue: 8, path: PATH, lines: ['Gear: + Sandbag'], state: 'approved', reason: '', at: 'x' });
  assert.equal(project.shas[PATH], DOWNLOAD_AGAIN);
  assert.deepEqual(filesToDownload(project, { [PATH]: 'sha-new' }), [PATH], 'downloaded again in the same sync');
});

test('a suggestion closed as not approved is logged with its reason', async () => {
  fakeGitHub((method, path) => {
    if (path.startsWith('/issues?')) return [closedIssue(8)];
    if (path.startsWith('/issues/8/comments?')) return [{ body: 'looking at it' }, { body: 'not approved: we have enough sandbags' }];
    return 404;
  });
  const store = memoryStore(crewProject({ crewSuggestions: { base: {}, sent: { [PATH]: { issue: 8, saved_at: SAVED } }, log: [] } }));
  await takeBackClosed(connection, store);
  const entry = store.project.crewSuggestions.log[0];
  assert.equal(entry.state, 'not approved');
  assert.equal(entry.reason, 'we have enough sandbags');
});

test('someone else\'s closed suggestion, or an open one, changes nothing', async () => {
  fakeGitHub((method, path) => (path.startsWith('/issues?') ? [closedIssue(8, 'Marta'), { ...closedIssue(9), state: 'open' }] : 404));
  const start = crewProject({ crewSuggestions: { base: {}, sent: { [PATH]: { issue: 8, saved_at: SAVED }, 'scenes.json': { issue: 9, saved_at: SAVED } }, log: [] } });
  const store = memoryStore(start);
  assert.equal(await takeBackClosed(connection, store), 0);
  assert.equal(store.project, start);
});

test('with nothing sent, closed suggestions are not even looked for', async () => {
  const asked = fakeGitHub(() => 404);
  assert.equal(await takeBackClosed(connection, memoryStore(crewProject())), 0);
  assert.deepEqual(asked, []);
});

test('a crew phone never gets conflicts: its proposed file stays until the suggestion is closed', () => {
  const before = noteBases(crewProject());
  assert.deepEqual(before.crewSuggestions.base, { [PATH]: 'sha-base' }, 'the version the change started from');
  const merged = keepProposed(applyRemote(before, { [PATH]: [umbrella, { id: 'g2', name: 'XLR cable' }] }, { [PATH]: 'sha-new' }));
  assert.deepEqual(merged.conflicts, {});
  assert.deepEqual(merged.gearItems, [umbrella, sandbag]);
  assert.deepEqual(merged.outbox, { [PATH]: { saved_at: SAVED } });
  assert.equal(merged.shas[PATH], 'sha-new');
  assert.deepEqual(noteBases(merged).crewSuggestions.base, { [PATH]: 'sha-base' }, 'the start version is kept');
});
