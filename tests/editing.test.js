// editing.test.js — checks editing rules and syncing with the repo, using a
// small made-up film. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warnings, usedByOtherRows, sameDaySuggestions, cleanRows } from '../src/preset-rules.js';
import { projectToFiles, applyRemote, filesToDownload, formatJson, emptyProject, sameRows } from '../src/store/repo-files.js';

const row = (char_id, tx_id, lav_id, speaker = 'yes') => ({ char_id, tx_id, lav_id, speaker });
const project = {
  id: 'test', name: 'Test film', folder: 'projects/test',
  characters: [{ id: '1', name: 'ANNA' }, { id: '2', name: 'BRUNO' }],
  transmitters: [{ id: '1' }, { id: '2' }], lavaliers: [{ id: '7' }, { id: '8' }],
  schedule: [
    { scene_id: '1', day: 1, order: 1, date: '2026-09-21', week: 1 },
    { scene_id: '2', day: 1, order: 2, date: '2026-09-21', week: 1 },
    { scene_id: '3', day: 2, order: 1, date: '2026-09-22', week: 1 },
  ],
  scenes: {},
  presets: {
    1: { scene_id: '1', rows: [row('1', '2', '8'), row('2', '1', '7')] },
    2: { scene_id: '2', rows: [row('1', '2', '8')] },
  },
  shas: {}, outbox: {}, conflicts: {},
};

test('the same TX or lav twice in a scene gives a warning', () => {
  assert.deepEqual(warnings([row('1', '3', '7'), row('2', '3', '8')]), ['TX 3 is used 2 times']);
  assert.deepEqual(warnings([row('1', '3', '7'), row('2', '4', '8')]), []);
});

test('the picker greys out what the other rows already use', () => {
  const rows = [row('1', '3', '7'), row('2', '4', '8')];
  assert.deepEqual([...usedByOtherRows(rows, 0, 'tx_id')], ['4']);
});

test('suggestions: what the character wears in the other scenes of that day', () => {
  assert.deepEqual(sameDaySuggestions(project, '2', '2'), { tx: ['1'], lav: ['7'] });
  assert.deepEqual(sameDaySuggestions(project, '3', '1'), { tx: [], lav: [] }); // other day
});

test('screen-only row keys are not saved', () => {
  assert.deepEqual(cleanRows([{ ...row('1', '2', '8'), key: 'abc' }]), [row('1', '2', '8')]);
});

test('a film becomes one file per list and one per scene preset', () => {
  const files = projectToFiles(project);
  assert.ok(files['film.json'] && files['schedule.json'] && files['presets/1.json'] && files['presets/2.json']);
});

test('repo files are readable: one row per line', () => {
  const text = formatJson({ rows: [row('1', '2', '8')] });
  assert.match(text, /\{ "char_id": "1", "tx_id": "2", "lav_id": "8", "speaker": "yes" \}/);
});

test('only files whose fingerprint changed are downloaded', () => {
  const local = { ...project, shas: { 'film.json': 'a', 'presets/1.json': 'b' } };
  assert.deepEqual(filesToDownload(local, { 'film.json': 'a', 'presets/1.json': 'c', 'presets/9.json': 'd' }),
    ['presets/1.json', 'presets/9.json']);
});

test('changes from another device arrive', () => {
  const theirs = { scene_id: '2', rows: [row('2', '2', '8')] };
  const merged = applyRemote(project, { 'presets/2.json': theirs }, { 'presets/2.json': 'x' });
  assert.deepEqual(merged.presets['2'].rows, theirs.rows);
});

test('a scene saved on this device is never overwritten by the repo', () => {
  const mine = [row('1', '1', '7')];
  const local = { ...project, outbox: { 2: { rows: mine, saved_at: 't' } } };
  const merged = applyRemote(local, { 'presets/2.json': { scene_id: '2', rows: [row('2', '2', '8')] } }, {});
  assert.ok(merged.conflicts['2'], 'both changed it: the user must choose');
  assert.deepEqual(merged.outbox['2'].rows, mine);
});

test('if the repo already has exactly my change, nothing is left to upload', () => {
  const mine = [row('1', '1', '7')];
  const local = { ...project, outbox: { 2: { rows: mine, saved_at: 't' } } };
  const merged = applyRemote(local, { 'presets/2.json': { scene_id: '2', rows: mine } }, {});
  assert.equal(merged.outbox['2'], undefined);
  assert.equal(merged.conflicts['2'], undefined);
});

test('a new device starts empty, then fills from the repo', () => {
  const fresh = emptyProject({ id: 'test', name: 'Test film' }, 'projects/test');
  const merged = applyRemote(fresh, projectToFiles(project), { 'film.json': 'a' });
  assert.equal(merged.characters.length, 2);
  assert.equal(Object.keys(merged.presets).length, 2);
  assert.ok(sameRows(merged.presets['1'].rows, project.presets['1'].rows));
});
