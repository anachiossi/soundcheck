// editing.test.js — checks editing rules and syncing with the repo, using a
// small made-up film. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warnings, usedByOtherRows, sameDaySuggestions, cleanRows, preferredFor, scenesUsing, sameDayKit, lavNotUsed } from '../src/preset-rules.js';
import { projectToFiles, applyRemote, filesToDownload, formatJson, emptyProject, sameRows, upgradeOutbox } from '../src/store/repo-files.js';

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

test('a kit set in one scene stays the same in the other scenes of the day', () => {
  // ANNA gets TX 1 + lav 7 in scene 1: scene 2 follows; BRUNO's TX 1 there would be emptied; scene 3 (other day) not
  const p = { ...project, presets: { ...project.presets, 2: { scene_id: '2', rows: [row('1', '2', '8'), row('2', '1', '')] } } };
  assert.deepEqual(sameDayKit(p, '1', [{ ...row('1', '1', '7'), acc: ['g1'] }, row('2', '', '')]),
    { 2: [{ ...row('1', '1', '7'), acc: ['g1'] }, row('2', '', '')] });
  assert.deepEqual(sameDayKit(p, '1', [row('1', '2', '8')]), {}, 'nothing changes, nothing saved');
  assert.deepEqual(sameDayKit(p, '1', [row('1', '', '')]), {}, 'an emptied TX does not travel');
});

test('lav models the film does not use', () => {
  const p = { settings: { presets: { lav_rules: { not_used: ['6061'] } } } };
  assert.equal(lavNotUsed(p, { model: '6061' }), true);
  assert.equal(lavNotUsed(p, { model: '6060' }), false);
  assert.equal(lavNotUsed({}, { model: '6061' }), false);
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
  assert.deepEqual(filesToDownload(local, { 'film.json': 'a', 'presets/1.json': 'c', 'presets/9.json': 'd', 'inbox.json': 'e' }),
    ['presets/1.json', 'presets/9.json'], 'inbox.json is not an app file');
});

test('changes from another device arrive', () => {
  const theirs = { scene_id: '2', rows: [row('2', '2', '8')] };
  const merged = applyRemote(project, { 'presets/2.json': theirs }, { 'presets/2.json': 'x' });
  assert.deepEqual(merged.presets['2'].rows, theirs.rows);
});

const mine = [row('1', '1', '7')];
const edited = { ...project, presets: { ...project.presets, 2: { scene_id: '2', rows: mine } },
  outbox: { 'presets/2.json': { saved_at: 't' } } };

test('a scene saved on this device is never overwritten by the repo', () => {
  const merged = applyRemote(edited, { 'presets/2.json': { scene_id: '2', rows: [row('2', '2', '8')] } }, {});
  assert.ok(merged.conflicts['presets/2.json'], 'both changed it: the user must choose');
  assert.deepEqual(merged.presets['2'].rows, mine);
});

test('if the repo already has exactly my change, nothing is left to upload', () => {
  const merged = applyRemote(edited, { 'presets/2.json': { scene_id: '2', rows: mine } }, {});
  assert.equal(merged.outbox['presets/2.json'], undefined);
  assert.equal(merged.conflicts['presets/2.json'], undefined);
});

test('a changed character list is protected the same way', () => {
  const renamed = { ...project, characters: [{ id: '1', name: 'ANNA B' }], outbox: { 'characters.json': { saved_at: 't' } } };
  const merged = applyRemote(renamed, { 'characters.json': [{ id: '1', name: 'ANNA C' }] }, {});
  assert.equal(merged.characters[0].name, 'ANNA B');
  assert.ok(merged.conflicts['characters.json']);
});

test('devices with the old outbox (by scene number) are upgraded', () => {
  const old = { ...project, outbox: { 12: { rows: mine, saved_at: 't' } }, conflicts: { 3: { theirs: {} } } };
  const upgraded = upgradeOutbox(old);
  assert.deepEqual(upgraded.outbox, { 'presets/12.json': { saved_at: 't' } });
  assert.ok(upgraded.conflicts['presets/3.json']);
});

test('a new device starts empty, then fills from the repo', () => {
  const fresh = emptyProject({ id: 'test', name: 'Test film' }, 'projects/test');
  const merged = applyRemote(fresh, projectToFiles(project), { 'film.json': 'a' });
  assert.equal(merged.characters.length, 2);
  assert.equal(Object.keys(merged.presets).length, 2);
  assert.ok(sameRows(merged.presets['1'].rows, project.presets['1'].rows));
});

test('preferred TX, and lavs of the preferred model in the preferred colour', () => {
  const film = {
    ...project,
    characters: [{ id: '1', name: 'ANNA', pref_tx: '5', pref_lav_model: '6060', pref_lav_color: '#FAF1D9' }, { id: '2', name: 'BRUNO' }],
    lavaliers: [
      { id: '1', model: '6060', color: '#000000' }, { id: '2', model: '6060', color: '#faf1d9' },
      { id: '3', model: '4060', color: '#faf1d9' }, { id: '4', model: '6060', color: '#faf1d9' },
    ],
  };
  assert.deepEqual(preferredFor(film, '1', 'tx_id'), ['5']);
  assert.deepEqual(preferredFor(film, '1', 'lav_id'), ['2', '4']);
  assert.deepEqual(preferredFor(film, '2', 'lav_id'), [], 'no preferences, no suggestions');
});

test('kit: which scenes use a TX (so it cannot be deleted)', () => {
  assert.deepEqual(scenesUsing(project, 'transmitters', '2'), ['1', '2']);
  assert.deepEqual(scenesUsing(project, 'lavaliers', '99'), []);
});

test('files an older app version skipped are downloaded again', () => {
  const local = { ...project, shas: { 'lines/script/2.json': 'x', 'presets/1.json': 'b' }, lines: {} };
  assert.deepEqual(filesToDownload(local, { 'lines/script/2.json': 'x', 'presets/1.json': 'b' }), ['lines/script/2.json']);
});

test('the Acc. column: a row keeps its accessories when saved, none = no field (v128)', async () => {
  const { cleanRows } = await import('../src/preset-rules.js');
  assert.deepEqual(cleanRows([{ char_id: '1', tx_id: '3', lav_id: '12', speaker: 'yes', acc: ['g117'], key: 'k' }]),
    [{ char_id: '1', tx_id: '3', lav_id: '12', speaker: 'yes', acc: ['g117'] }]);
  assert.deepEqual(cleanRows([{ char_id: '1', tx_id: '3', lav_id: '', speaker: 'no', acc: [] }]),
    [{ char_id: '1', tx_id: '3', lav_id: '', speaker: 'no' }]);
});
