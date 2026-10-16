// crew-approve.test.js — on Ana's own devices: the crew's suggestions to approve (crew-inbox.js,
// crew-approve.js) and how the owner sync sends the decisions (sync.js).
// GitHub is never called: fetch is replaced by a fake. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newestSuggestions, approvalNote, decisionComment, readyDecisions } from '../src/crew-inbox.js';
import { approvedFilm, approveSuggestion } from '../src/crew-approve.js';
import { ownerInbox } from '../src/crew-inbox-sync.js';
import { rememberDecisions } from '../src/crew-decisions.js';
import { syncAsOwner } from '../src/sync.js';
import { getState, setState } from '../src/state.js';
import { suggestionIssue } from '../src/crew-changes.js';

const connection = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Office laptop' };
const FOLDER = 'projects/test-film';
const PATH = 'gear/items.json';
const umbrella = { id: 'g1', name: 'Umbrella top', qty: 1 };
const sandbag = { id: 'g3', name: 'Sandbag', qty: 4 };
const cable = { id: 'g2', name: 'XLR cable', qty: 10 };

// A GitHub issue holding a suggestion, as a crew phone writes it.
function suggestionOnGitHub(number, { by = 'Davide', path = PATH, film = FOLDER, state = 'open', created_at = '2026-10-16T10:00:00Z' } = {}) {
  const details = { by, film, path, base_sha: 'sha-base', changes: [{ op: 'set', id: 'g3', value: sandbag }], saved_at: created_at };
  return { number, state, created_at, ...suggestionIssue(details, ['Gear: + Sandbag']) };
}

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

// The repo: one film with its gear list. Upload works; issues answer with `issues` (or an error).
function repo({ issues = [], commit = { sha: 'c2' } } = {}) {
  return (method, path) => {
    if (path === '/git/ref/heads/main') return { object: { sha: 'c1' } };
    if (path === '/git/commits/c1') return { tree: { sha: 't1' } };
    if (path.startsWith('/git/trees/t1')) return { tree: [{ type: 'blob', path: `${FOLDER}/${PATH}`, sha: 'sha-now' }] };
    if (method === 'POST' && path === '/git/trees') return { sha: 't2' };
    if (method === 'POST' && path === '/git/commits') return commit;
    if (method === 'PATCH' && path === '/git/refs/heads/main') return {};
    if (method === 'GET' && path.startsWith('/issues?')) return issues;
    if (method === 'POST' && /^\/issues\/\d+\/comments$/.test(path)) return {};
    if (method === 'PATCH' && /^\/issues\/\d+$/.test(path)) return {};
    return 404;
  };
}

function memoryStore(project) {
  const store = { project, read: () => store.project, save: async next => { store.project = next; } };
  return store;
}

// Ana's film on this device; `outbox` = files saved here and not uploaded yet.
function ownerProject(outbox = {}) {
  return { id: 'test-film', name: 'Test Film', folder: FOLDER, presets: {}, schedule: [], gearItems: [umbrella, cable],
    shas: { [PATH]: 'sha-now' }, outbox, conflicts: {} };
}

const decision = (issue, kind, extra = {}) => ({ issue, decision: kind, reason: '', by: 'Davide', path: PATH, film: FOLDER, ...extra });

test('only the newest open suggestion per person and file of this film is shown', () => {
  const issues = [
    suggestionOnGitHub(7, { created_at: '2026-10-16T09:00:00Z' }),
    suggestionOnGitHub(9, { created_at: '2026-10-16T11:00:00Z' }),
    suggestionOnGitHub(8, { by: 'Marta', created_at: '2026-10-16T10:00:00Z' }),
    suggestionOnGitHub(10, { path: 'scenes.json' }),
    suggestionOnGitHub(11, { film: 'projects/other-film' }),
    suggestionOnGitHub(12, { state: 'closed' }),
    { number: 13, state: 'open', body: 'The truck is late' },
  ];
  const shown = newestSuggestions(issues, FOLDER);
  assert.deepEqual(shown.map(suggestion => suggestion.issue).sort(), [10, 8, 9].sort());
  const davide = shown.find(suggestion => suggestion.issue === 9);
  assert.equal(davide.by, 'Davide');
  assert.deepEqual(davide.lines, ['Gear: + Sandbag']);
  assert.equal(davide.base_sha, 'sha-base');
});

test('approving puts the change into the film as it is now and keeps Ana\'s newer edit of another record', () => {
  const base = [umbrella];
  const ana = { ...umbrella, qty: 2 }; // Ana changed the umbrella after Davide started
  const project = { ...ownerProject(), gearItems: [ana, cable] };
  const suggestion = { issue: 9, by: 'Davide', path: PATH, film: FOLDER, changes: [{ op: 'set', id: 'g3', value: sandbag }] };
  const result = approvedFilm(project, suggestion, base, '2026-10-16T12:00:00Z');
  assert.deepEqual(result.clashes, []);
  assert.deepEqual(result.project.gearItems, [ana, cable, sandbag]);
  assert.deepEqual(result.project.outbox, { [PATH]: { saved_at: '2026-10-16T12:00:00Z' } }, 'uploaded like a normal save');
  assert.deepEqual(project.gearItems, [ana, cable], 'the film on screen is not changed until saved');
});

test('approving a record someone changed meanwhile, differently, is a clash', () => {
  const project = { ...ownerProject(), gearItems: [{ ...umbrella, qty: 2 }] };
  const suggestion = { issue: 9, by: 'Davide', path: PATH, film: FOLDER, changes: [{ op: 'set', id: 'g1', value: { ...umbrella, qty: 3 } }] };
  const result = approvedFilm(project, suggestion, [umbrella]);
  assert.equal(result.clashes.length, 1);
  assert.deepEqual(result.project.gearItems, [{ ...umbrella, qty: 3 }], '"Approve anyway" takes the suggestion');
});

test('the commit message says who proposed an approved change', () => {
  assert.equal(approvalNote([PATH], [decision(9, 'approved')], FOLDER), ' — proposed by Davide, approved');
  assert.equal(approvalNote([PATH, 'scenes.json'], [decision(9, 'approved'), decision(10, 'approved', { by: 'Marta', path: 'scenes.json' })], FOLDER),
    ' — proposed by Davide and Marta, approved');
  assert.equal(approvalNote([PATH], [decision(9, 'not approved')], FOLDER), '', 'not approved: nothing to say');
  assert.equal(approvalNote(['scenes.json'], [decision(9, 'approved')], FOLDER), '', 'another file');
  assert.equal(approvalNote([PATH], [decision(9, 'approved', { film: 'projects/other-film' })], FOLDER), '', 'another film');
});

test('the closing words start with "approved" or "not approved" and never name anyone', () => {
  assert.equal(decisionComment(decision(9, 'approved')), 'approved');
  assert.equal(decisionComment(decision(9, 'not approved', { reason: 'we have enough' })), 'not approved: we have enough');
  assert.equal(decisionComment(decision(9, 'not approved')), 'not approved');
});

test('an approval waits while its file is not uploaded; a "not approved" goes at once', () => {
  const decisions = [decision(9, 'approved'), decision(10, 'not approved', { path: 'scenes.json' })];
  const waiting = ownerProject({ [PATH]: { saved_at: 'x' }, 'scenes.json': { saved_at: 'x' } });
  assert.deepEqual(readyDecisions(decisions, waiting).map(item => item.issue), [10]);
  assert.deepEqual(readyDecisions(decisions, ownerProject()).map(item => item.issue), [9, 10]);
});

test('owner sync: an approval is commented and closed only after the commit, with the proposer in the message', async () => {
  rememberDecisions([decision(9, 'approved')]);
  const asked = fakeGitHub(repo({ issues: [suggestionOnGitHub(9)] }));
  const store = memoryStore(ownerProject({ [PATH]: { saved_at: '2026-10-16T12:00:00Z' } }));
  assert.equal(await syncAsOwner(connection, store), 1);

  const commit = asked.findIndex(call => call.method === 'POST' && call.path === '/git/commits');
  const comment = asked.findIndex(call => call.path === '/issues/9/comments');
  const close = asked.findIndex(call => call.method === 'PATCH' && call.path === '/issues/9');
  assert.ok(commit >= 0 && commit < comment && comment < close, 'commit, then comment, then close');
  assert.equal(asked[commit].body.message, `Edit gear/items — Office laptop — proposed by Davide, approved`);
  assert.deepEqual(asked[comment].body, { body: 'approved' });
  assert.equal(asked[close].body.state, 'closed');
  assert.deepEqual(getState().crewDecisions, [], 'sent: no longer waiting');
});

test('owner sync: when the upload fails the approval is not sent and keeps waiting', async () => {
  rememberDecisions([decision(9, 'approved')]);
  const asked = fakeGitHub(repo({ commit: 500 }));
  const store = memoryStore(ownerProject({ [PATH]: { saved_at: '2026-10-16T12:00:00Z' } }));
  await assert.rejects(syncAsOwner(connection, store));
  assert.equal(asked.filter(call => call.path.startsWith('/issues')).length, 0);
  assert.equal(getState().crewDecisions.length, 1);
});

test('owner sync: "not approved" closes the suggestion with the reason', async () => {
  rememberDecisions([decision(9, 'not approved', { reason: 'we have enough sandbags' })]);
  const asked = fakeGitHub(repo());
  await syncAsOwner(connection, memoryStore(ownerProject()));
  assert.deepEqual(asked.find(call => call.path === '/issues/9/comments').body, { body: 'not approved: we have enough sandbags' });
  assert.equal(asked.find(call => call.method === 'PATCH' && call.path === '/issues/9').body.state_reason, 'not_planned');
  assert.deepEqual(getState().crewDecisions, []);
});

test('owner sync: the open suggestions are listed for the banner', async () => {
  rememberDecisions([]);
  fakeGitHub(repo({ issues: [suggestionOnGitHub(9)] }));
  await syncAsOwner(connection, memoryStore(ownerProject()));
  assert.deepEqual(getState().crewSuggestions.map(suggestion => [suggestion.issue, suggestion.by]), [[9, 'Davide']]);
});

test('owner sync: a key not allowed to read issues (403) leaves the sync working and shows nothing', async () => {
  rememberDecisions([]);
  setState({ crewSuggestions: [{ issue: 1 }] });
  fakeGitHub((method, path) => (path.startsWith('/issues') ? 403 : repo()(method, path)));
  const store = memoryStore(ownerProject({ [PATH]: { saved_at: '2026-10-16T12:00:00Z' } }));
  assert.equal(await syncAsOwner(connection, store), 1);
  assert.deepEqual(store.project.outbox, {}, 'uploaded as usual');
  assert.deepEqual(getState().crewSuggestions, []);
});

// ---- approving on the device: the order of saving and deciding ---------------------

// A fake device: the film database (indexedDB) and the small memory (localStorage) write what
// happens into `timeline`, in order.
function fakeDevice(timeline) {
  globalThis.localStorage = { getItem: () => null, removeItem() {},
    setItem: key => { if (key === 'sc_crew_decisions') timeline.push('decision'); } };
  const db = { close() {}, objectStoreNames: { contains: () => true },
    transaction: () => {
      const transaction = {};
      transaction.objectStore = () => ({ put: () => { timeline.push('film saved'); setTimeout(() => transaction.oncomplete()); return {}; } });
      return transaction;
    } };
  globalThis.indexedDB = { open: () => {
    const request = {};
    setTimeout(() => { request.result = db; request.onsuccess(); });
    return request;
  } };
}

const forgetDevice = () => { delete globalThis.localStorage; delete globalThis.indexedDB; };

test('approving saves the film into the outbox first, and only then remembers the decision', async () => {
  const timeline = [];
  fakeDevice(timeline);
  rememberDecisions([]);
  timeline.length = 0;
  setState({ connection: null, project: ownerProject() }); // no connection: the sync after it does nothing
  const suggestion = { issue: 9, by: 'Davide', path: PATH, film: FOLDER, base_sha: null, changes: [{ op: 'set', id: 'g3', value: sandbag }] };
  assert.deepEqual(await approveSuggestion(suggestion), { done: true });
  assert.deepEqual(timeline, ['film saved', 'decision']);
  assert.ok(getState().project.outbox[PATH], 'the file waits in the outbox');
  assert.equal(getState().crewDecisions[0].decision, 'approved');
  forgetDevice();
});

test('an approval whose film could not be saved is never remembered as a decision', async () => {
  rememberDecisions([]);
  setState({ connection: null, project: ownerProject() }); // no database on this "device": saving fails
  const suggestion = { issue: 9, by: 'Davide', path: PATH, film: FOLDER, base_sha: null, changes: [{ op: 'set', id: 'g3', value: sandbag }] };
  await assert.rejects(approveSuggestion(suggestion));
  assert.deepEqual(getState().crewDecisions, []);
});

test('a whole-file suggestion whose file changed since the crew started cannot be approved, not even "anyway"', async () => {
  const timeline = [];
  fakeDevice(timeline);
  rememberDecisions([]);
  timeline.length = 0;
  const path = 'gear/history.json';
  const blob = { content: Buffer.from(JSON.stringify([{ at: 'a' }])).toString('base64') };
  fakeGitHub((method, url) => (url.startsWith('/git/blobs/') ? blob : 404));
  setState({ connection, project: { ...ownerProject(), gearHistory: [{ at: 'z' }] } });
  const suggestion = { issue: 9, by: 'Davide', path, film: FOLDER, base_sha: 'sha-base', changes: [{ op: 'replace', value: [{ at: 'b' }] }] };
  assert.deepEqual(await approveSuggestion(suggestion), { stale: true });
  assert.deepEqual(await approveSuggestion(suggestion, { anyway: true }), { stale: true });
  assert.deepEqual(timeline, [], 'nothing saved, no decision');
  forgetDevice();
});

test('owner sync: a key that may not answer issues (403) keeps the decisions and says so once, quietly', async () => {
  rememberDecisions([decision(9, 'not approved')]);
  setState({ message: null, crewCantAnswer: false });
  fakeGitHub((method, path) => (method === 'GET' ? [] : 403));
  const store = memoryStore(ownerProject());
  await ownerInbox(connection, store);
  await ownerInbox(connection, store);
  assert.equal(getState().crewDecisions.length, 1, 'the decision waits');
  assert.equal(getState().crewCantAnswer, true);
  assert.equal(getState().message, null, 'no message at each sync');

  fakeGitHub((method, path) => (method === 'GET' ? [] : {}));
  await ownerInbox(connection, store);
  assert.deepEqual(getState().crewDecisions, [], 'sent once the key may');
  assert.equal(getState().crewCantAnswer, false);
});
