// cues-game.test.js — the Who's next game: beats, speakers, rounds, mistakes. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameBeats, speakersOf, startGame, tap, lineNow, BEAT_MAX } from '../src/cues-game-rules.js';

const say = (char_id, text, action) => ({ name: `C${char_id}`, char_id, text, action });
const cast = [{ id: '1', name: 'INES' }, { id: '9', name: 'MARIO' }];
const lines = [say('1', 'Ciao.'), say('9', 'Ciao a te.'), say('1', 'Come stai?')];

test('the buttons are the speakers, in the order they first speak', () => {
  assert.deepEqual(speakersOf(lines).map(s => s.id), ['1', '9']);
});

test('a long beat is cut into pieces of at most 8 lines', () => {
  const many = Array.from({ length: 20 }, (_, i) => say(i % 2 ? '9' : '1', 'Sì.'));
  assert.deepEqual(gameBeats(many, cast).map(b => [b.start, b.end]), [[0, 8], [8, 16], [16, 20]]);
  assert.equal(BEAT_MAX, 8);
});

test('a new beat starts where someone enters', () => {
  const scene = [say('1', 'Ciao.'), say('1', 'Nessuno?'), say('9', 'Eccomi.', 'In quel momento appare MARIO.')];
  assert.deepEqual(gameBeats(scene, cast).map(b => [b.start, b.end]), [[0, 2], [2, 3]]);
});

test('each round goes one line further, always from the start of the beat', () => {
  const beats = [{ start: 0, end: 3 }];
  let game = startGame();
  game = tap(game, beats, lines, '1');                    // round 1: line 1 ✓
  assert.deepEqual([game.round, game.step], [2, 0]);
  game = tap(game, beats, lines, '1');                    // round 2: line 1 ✓
  assert.equal(lineNow(game, beats), 1);
  game = tap(game, beats, lines, '9');                    // round 2: line 2 ✓
  assert.deepEqual([game.round, game.step], [3, 0]);
});

test('a wrong tap shows the line missed and starts the round again; the end says done', () => {
  const beats = [{ start: 0, end: 2 }];
  let game = tap(startGame(), beats, lines, '9');         // wrong: line 1 is Ines
  assert.deepEqual([game.round, game.step, game.mistakes, game.missed.line], [1, 0, 1, 0]);
  game = tap(game, beats, lines, '1');
  assert.equal(game.missed, null);
  game = tap(tap(game, beats, lines, '1'), beats, lines, '9');
  assert.equal(game.done, true);
});
