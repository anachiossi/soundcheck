// cues-map.test.js — the Scene Map: cues and beats. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneMap } from '../src/cues-map-rules.js';

const say = (char_id, text) => ({ name: `C${char_id}`, char_id, text });

test('the cue is how the line ends: last sentence (full) and last 4 words (fast)', () => {
  const [beat] = sceneMap([say('1', 'Ciao. Come stai? Io bene, grazie mille davvero.')]);
  assert.equal(beat.rows[0].cue.full, '…Io bene, grazie mille davvero.');
  assert.equal(beat.rows[0].cue.fast, '…bene, grazie mille davvero.');
});

test('a short line is its own cue, without dots', () => {
  const [beat] = sceneMap([say('1', 'Marco!')]);
  assert.equal(beat.rows[0].cue.full, 'Marco!');
  assert.equal(beat.rows[0].cue.fast, 'Marco!');
});

test('a new beat when someone enters, but not before 3 lines', () => {
  const lines = [say('1', 'a'), say('2', 'b'), say('1', 'c'), say('2', 'd'), say('3', 'enters')];
  const beats = sceneMap(lines);
  assert.deepEqual(beats.map(b => [b.from, b.to]), [[0, 3], [4, 4]]);
  assert.equal(beats[1].rows[0].entrance, true);
});

test('a long speech starts a beat and the next line starts another', () => {
  const long = Array(45).fill('parola').join(' ');
  const lines = [say('1', 'a'), say('2', 'b'), say('1', 'c'), say('2', long), say('1', 'e'), say('2', 'f'), say('1', 'g')];
  assert.deepEqual(sceneMap(lines).map(b => [b.from, b.to]), [[0, 2], [3, 3], [4, 6]]);
});

test('never more than 8 lines in a beat', () => {
  const lines = Array.from({ length: 20 }, (_, i) => say(String(i % 2), 'x'));
  assert.deepEqual(sceneMap(lines).map(b => b.rows.length), [8, 8, 4]);
});
