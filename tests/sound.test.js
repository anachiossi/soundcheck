// sound.test.js — the sound breakdown: suggested level, lav warnings, the proposal change. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestedLevel, lavProblems, warningsFor, soundSummary } from '../src/sound-rules.js';
import { applyChange } from '../src/proposal-rules.js';
import { fileContent, setFileContent } from '../src/store/repo-files.js';

const rows = speakers => speakers.map((speaker, i) => ({ char_id: String(i + 1), tx_id: String(i + 1), lav_id: String(i + 1), speaker }));
const film = (presetRows, sound = {}, intExt = 'INT') => ({
  characters: [{ id: '1', name: 'INES' }, { id: '2', name: 'OONA' }],
  presets: { 7: { rows: presetRows } }, scenes: { 7: { int_ext: intExt } }, sound: { 7: sound },
});

test('suggested level follows who speaks: 0 AMB, 1–2 EASY, 3–4 MEDIUM, 5+ HARD', () => {
  assert.equal(suggestedLevel(film(rows(['no', 'no'])), '7'), 2);
  assert.equal(suggestedLevel(film(rows(['yes', 'no'])), '7'), 3);
  assert.equal(suggestedLevel(film(rows(['yes', 'yes', 'yes'])), '7'), 4);
  assert.equal(suggestedLevel(film(rows(['yes', 'yes', 'yes', 'yes', 'yes'])), '7'), 5);
});

test('one step harder at most: EXT with 2 speakers, or a flag like scream; live music = HARD', () => {
  assert.equal(suggestedLevel(film(rows(['yes', 'yes']), {}, 'EXT'), '7'), 4);
  assert.equal(suggestedLevel(film(rows(['yes', 'yes']), { flags: ['scream', 'water'] }, 'EXT'), '7'), 4);
  assert.equal(suggestedLevel(film(rows(['no']), { flags: ['music'] }), '7'), 5);
});

test('a "No lav" warning makes Save ask when that character has a lav', () => {
  const f = film(rows(['yes', 'yes']), { warnings: [{ char_id: '2', kind: 'no-lav', text: 'jumps in the pool' }] });
  assert.equal(warningsFor(f, '7', '2').length, 1);
  assert.deepEqual(lavProblems(f, '7', f.presets[7].rows), ['OONA has a lav, but: no lav in this scene']);
  assert.deepEqual(lavProblems(f, '7', [{ char_id: '2', tx_id: '2', lav_id: '' }]), []);
});

test('the day summary counts levels and warnings', () => {
  const f = film([], { level: 4, warnings: [{ char_id: '1', kind: 'loud' }] });
  assert.deepEqual(soundSummary(f, ['7', '8']), { levels: { 4: 1 }, warnings: 1, rated: 1 });
});

test('set_sound (from a proposal) writes sound/<scene>.json, kept as its own file', () => {
  const { film: after, files } = applyChange({ sound: {} }, { op: 'set_sound', scene_id: '30', fields: { level: 5, flags: ['water'] } });
  assert.deepEqual(files, ['sound/30.json']);
  assert.equal(fileContent(after, 'sound/30.json').level, 5);
  const copy = { sound: {} };
  setFileContent(copy, 'sound/30.json', { level: 2 });
  assert.equal(copy.sound[30].level, 2);
});
