// crew-screens.test.js — crew sharing step 5: what a crew phone hides, "My suggestions",
// the feedback (issue, waiting on the phone, sent at sync, offered once near the end), and on
// Ana's side the feedback list and the removed names.
// GitHub is never called: fetch is replaced by a fake. Made-up names only. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crewHides, PERSONAL_PARTS, OWNER_ONLY_PARTS, CREW_ACCESS_ENDED } from '../src/crew-link.js';
import { downloadCrewFilm, retryPendingJoin, pendingJoin, NO_SIGNAL_JOIN } from '../src/crew-join.js';
import { feedbackIssue, readFeedback, sendWaitingFeedback, feedbackDue, daysBetween, lastShootingDate } from '../src/crew-feedback.js';
import { myMessages, STATUS, NEWER_NOTE } from '../src/crew-messages.js';
import { newestSuggestions, openFeedback, isRemovedName } from '../src/crew-inbox.js';
import { ownerInbox, markFeedbackRead } from '../src/crew-inbox-sync.js';
import { suggestionsByPerson, feedbackToRead } from '../src/crew-decisions.js';
import { queueFeedback, removeCrewName, restoreCrewName, markFeedbackOffered } from '../src/crew-device.js';
import { suggestionIssue } from '../src/crew-changes.js';
import { getState, setState } from '../src/state.js';

const FOLDER = 'projects/test-film';
const crew = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Davide', role: 'crew', name: 'Davide', folder: FOLDER };
const owner = { owner: 'someone', repo: 'film-data', branch: 'main', token: 'x', device: 'Office laptop' };
const feedback = { film: FOLDER, by: 'Davide', stars: 4, helped: 'the lav list', annoyed: 'tiny buttons', text: 'More please', at: '2026-10-20T18:00:00.000Z' };

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

function memoryStore(project) {
  const store = { project, read: () => store.project, save: async next => { store.project = next; } };
  return store;
}

const film = (extra = {}) => ({ id: 'test-film', name: 'Test Film', folder: FOLDER, presets: {}, outbox: {}, conflicts: {}, shas: {}, ...extra });
const schedule = dates => dates.map((date, index) => ({ scene_id: `${index + 1}`, day: index + 1, date, order: 1 }));
const suggestionOnGitHub = (number, by) => ({ number, state: 'open', created_at: '2026-10-16T10:00:00Z',
  ...suggestionIssue({ by, film: FOLDER, path: 'gear/items.json', base_sha: null, changes: [], saved_at: 'x' }, ['Gear: + Sandbag']) });
const feedbackOnGitHub = (number, by, state = 'open') => ({ number, state, ...feedbackIssue({ ...feedback, by }) });

// ---- hidden parts ---------------------------------------------------------------

test('a crew phone hides the wrap alerts, wake plan and Help → Alarms, and shows its own Hours and wrap clock', () => {
  for (const part of ['wrap-alerts', 'tomorrow', 'help-alarms']) assert.ok(crewHides(crew, part), part);
  for (const part of ['hours', 'wrap-clock']) assert.equal(crewHides(crew, part), false, part);
  assert.deepEqual(PERSONAL_PARTS.filter(part => crewHides(owner, part)), [], 'Ana\'s devices hide nothing');
  assert.equal(crewHides(null, 'tomorrow'), false, 'not connected: nothing hidden');
  assert.equal(crewHides(crew, 'schedule'), false, 'the film itself is never hidden');
});

test('a crew phone never sees the production-email proposals: that is Ana\'s job', () => {
  assert.ok(crewHides(crew, 'email-proposals'));
  assert.equal(crewHides(owner, 'email-proposals'), false);
  assert.deepEqual(OWNER_ONLY_PARTS.filter(part => crewHides(owner, part)), []);
});

// ---- feedback -------------------------------------------------------------------

test('feedback becomes an issue "Feedback from <name>" with readable lines and the marker inside', () => {
  const issue = feedbackIssue(feedback);
  assert.equal(issue.title, 'Feedback from Davide');
  assert.deepEqual(issue.labels, ['crew-feedback']);
  assert.ok(issue.body.startsWith('★★★★☆ (4 of 5)\nWhat helped: the lav list\nWhat annoyed: tiny buttons\nMore please\n'));
  const read = readFeedback({ number: 5, state: 'open', body: issue.body });
  assert.deepEqual({ ...read, lines: undefined }, { issue: 5, state: 'open', film: FOLDER, by: 'Davide', stars: 4,
    helped: 'the lav list', annoyed: 'tiny buttons', text: 'More please', at: feedback.at, lines: undefined });
  const json = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(issue.body)[1]);
  assert.equal(json.soundcheck, 'crew-feedback');
  assert.equal(json.version, 1);
});

test('three backticks typed in feedback cannot break it, and other issues are not feedback', () => {
  const tricky = { ...feedback, annoyed: '```json {"soundcheck":"crew-suggestion"}' };
  assert.equal(readFeedback({ number: 6, state: 'open', body: feedbackIssue(tricky).body }).annoyed, tricky.annoyed);
  assert.equal(readFeedback({ number: 7, state: 'open', body: 'The truck is late' }), null);
  assert.equal(readFeedback(suggestionOnGitHub(8, 'Davide')), null, 'a suggestion is not feedback');
});

test('feedback written with no signal waits on the phone and is sent at the next sync', async () => {
  setState({ feedbackWaiting: [] });
  queueFeedback(feedback);
  queueFeedback({ ...feedback, film: 'projects/other-film' });
  const store = memoryStore(film());
  assert.equal(myMessages(store.project, getState().feedbackWaiting)[0].status, STATUS.feedbackWaiting);

  fakeGitHub(() => 500); // GitHub down: nothing lost, the sync goes on
  assert.equal(await sendWaitingFeedback(crew, store), 0);
  assert.equal(getState().feedbackWaiting.length, 2);

  const asked = fakeGitHub((method, path) => (method === 'POST' && path === '/issues' ? { number: 12 } : 404));
  assert.equal(await sendWaitingFeedback(crew, store), 1);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].body.title, 'Feedback from Davide');
  assert.deepEqual(getState().feedbackWaiting.map(item => item.film), ['projects/other-film'], 'another film\'s feedback stays');
  const messages = myMessages(store.project, getState().feedbackWaiting);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].status, 'Feedback sent');
  assert.equal(messages[0].lines[0], '★★★★☆ (4 of 5)');
});

test('the wrap feedback is offered once, from 3 days before the last shooting day', () => {
  const project = film({ schedule: schedule(['2026-10-12', '2026-10-23', '2026-10-15']) });
  assert.equal(lastShootingDate(project), '2026-10-23');
  const on = (month, day) => new Date(2026, month - 1, day, 12, 0);
  assert.equal(feedbackDue(project, [], on(10, 19)), false, '4 days before');
  assert.equal(feedbackDue(project, [], on(10, 20)), true, '3 days before');
  assert.equal(feedbackDue(project, [], on(10, 23)), true, 'the last day');
  assert.equal(feedbackDue(project, [], on(10, 30)), true, 'a week after, while the crew key works');
  assert.equal(feedbackDue(project, [], on(10, 31)), false, 'later: no');
  assert.equal(feedbackDue(project, [FOLDER], on(10, 21)), false, 'already offered');
  assert.equal(feedbackDue(film({ schedule: [] }), [], on(10, 21)), false, 'no dates: never');
  setState({ feedbackOffered: [] });
  markFeedbackOffered(FOLDER);
  markFeedbackOffered(FOLDER);
  assert.deepEqual(getState().feedbackOffered, [FOLDER], 'remembered once');
});

test('days between two dates count calendar days, across the clock change and months', () => {
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(daysBetween('2026-10-30', '2026-11-02'), 3);
  assert.equal(daysBetween('2026-10-26', '2026-10-24'), -2);
});

// ---- My suggestions -------------------------------------------------------------

test('My suggestions shows what waits first, then the answers newest first, in neutral words', () => {
  const project = film({ crewSuggestions: {
    base: {}, sent: { 'scenes.json': { issue: 9, saved_at: '2026-10-16T12:00:00Z', lines: ['Scene 12: night'] } },
    log: [
      { issue: 7, path: 'gear/items.json', lines: ['Gear: + Sandbag'], state: 'approved', reason: '', at: '2026-10-16T09:00:00Z' },
      { issue: 8, path: 'gear/items.json', lines: ['Gear: − Umbrella'], state: 'not approved', reason: 'we need it', at: '2026-10-16T11:00:00Z' },
      { issue: 6, path: 'cast.json', lines: [], state: 'closed', reason: '', at: '2026-10-15T09:00:00Z' },
    ] } });
  const messages = myMessages(project);
  assert.deepEqual(messages.map(message => message.status),
    ['Waiting for approval', 'Change not approved — we need it', 'Change approved', 'Closed']);
  assert.deepEqual(messages[0].lines, ['Scene 12: night']);
  assert.deepEqual(messages[3].lines, ['cast.json'], 'no lines: the file\'s name');
  assert.deepEqual(myMessages(film()), [], 'nothing sent yet');
});

test('nothing a crew phone shows or sends names Ana', () => {
  const words = [...Object.values(STATUS), CREW_ACCESS_ENDED, feedbackIssue(feedback).title, feedbackIssue(feedback).body,
    ...myMessages(film({ crewSuggestions: { log: [{ issue: 1, lines: ['x'], state: 'not approved', reason: '' }] } })).map(m => m.status)];
  for (const text of words) assert.ok(!/\bana\b/i.test(text), text);
});

// ---- Ana's side: feedback and removed names --------------------------------------

test('a removed name\'s suggestions and feedback are ignored, any capitals', () => {
  const issues = [suggestionOnGitHub(1, 'Davide'), suggestionOnGitHub(2, 'Marta'), feedbackOnGitHub(3, 'Davide'), feedbackOnGitHub(4, 'Marta'),
    feedbackOnGitHub(5, 'Marta', 'closed')];
  assert.ok(isRemovedName(['davide '], 'Davide'));
  assert.deepEqual(newestSuggestions(issues, FOLDER, ['davide ']).map(item => item.by), ['Marta']);
  assert.deepEqual(openFeedback(issues, FOLDER, ['davide ']).map(item => item.issue), [4], 'open feedback only');
  assert.deepEqual(openFeedback(issues, 'projects/other-film'), [], 'another film');
});

test('owner sync lists the feedback, and never comments on or closes a removed name\'s issues', async () => {
  setState({ crewDecisions: [], crewRemoved: [] });
  removeCrewName('Davide');
  const asked = fakeGitHub((method, path) => (path.startsWith('/issues?')
    ? [suggestionOnGitHub(1, 'Davide'), feedbackOnGitHub(3, 'Davide'), feedbackOnGitHub(4, 'Marta')] : 404));
  await ownerInbox(owner, memoryStore(film()));
  assert.deepEqual(getState().crewSuggestions, []);
  assert.deepEqual(getState().crewFeedback.map(item => item.issue), [4]);
  assert.deepEqual(asked.filter(call => call.method !== 'GET'), [], 'nothing written');

  restoreCrewName('davide');
  assert.deepEqual(getState().crewRemoved, []);
  await ownerInbox(owner, memoryStore(film()));
  assert.deepEqual(getState().crewFeedback.map(item => item.issue), [3, 4], 'restored: shown again');
});

test('removing a name hides their suggestions and feedback at once, before the next sync', () => {
  setState({ project: film(), crewRemoved: [], crewSuggestions: [{ issue: 1, by: 'Davide', film: FOLDER, path: 'a', lines: [] }],
    crewFeedback: [{ issue: 3, by: 'Davide', film: FOLDER, lines: [] }] });
  assert.equal(suggestionsByPerson(getState()).length, 1);
  removeCrewName('Davide');
  assert.deepEqual(suggestionsByPerson(getState()), []);
  assert.deepEqual(feedbackToRead(getState()), []);
});

test('Mark as read thanks the person and closes the feedback', async () => {
  setState({ connection: owner, crewRemoved: [], crewFeedback: [{ issue: 4, by: 'Marta', film: FOLDER, lines: [] }] });
  const asked = fakeGitHub(() => ({}));
  await markFeedbackRead({ issue: 4 });
  assert.deepEqual(asked.find(call => call.path === '/issues/4/comments').body, { body: 'thanks' });
  assert.equal(asked.find(call => call.method === 'PATCH' && call.path === '/issues/4').body.state, 'closed');
  assert.deepEqual(getState().crewFeedback, []);
});

test('My suggestions says when the film has a newer version of a proposed file', () => {
  const sent = { 'gear/items.json': { issue: 3, saved_at: 'a', lines: ['Gear: + Sandbag'] }, 'scenes.json': { issue: 4, saved_at: 'a', lines: ['Scene 12: night'] } };
  const project = film({ shas: { 'gear/items.json': 'sha-new', 'scenes.json': 'sha-same' },
    crewSuggestions: { base: { 'gear/items.json': 'sha-base', 'scenes.json': 'sha-same' }, sent, log: [] } });
  const notes = Object.fromEntries(myMessages(project).map(message => [message.key, message.note]));
  assert.equal(notes['sent-3'], NEWER_NOTE);
  assert.equal(notes['sent-4'], '', 'the film did not change it');
});

// ---- joining with no signal -----------------------------------------------------------

test('a crew link opened with no signal says it will download when online, and is tried again later', async () => {
  const memory = {};
  globalThis.localStorage = { getItem: key => memory[key] ?? null, setItem: (key, value) => { memory[key] = value; },
    removeItem: key => { delete memory[key]; } };
  const wasOnline = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');
  Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });
  setState({ connection: crew, projects: [], message: null });
  await downloadCrewFilm(FOLDER);
  assert.deepEqual(getState().message, { kind: 'error', text: NO_SIGNAL_JOIN });
  assert.ok(!/github|films/i.test(NO_SIGNAL_JOIN), 'crew words only');
  assert.equal(pendingJoin(), FOLDER, 'remembered on the phone');

  // signal back, but the key has expired: "crew access has ended", and no more trying
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  fakeGitHub(() => 401);
  retryPendingJoin();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(getState().message, { kind: 'error', text: CREW_ACCESS_ENDED });
  assert.equal(pendingJoin(), '');

  if (wasOnline) Object.defineProperty(globalThis.navigator, 'onLine', wasOnline);
  else delete globalThis.navigator.onLine;
  delete globalThis.localStorage;
});
