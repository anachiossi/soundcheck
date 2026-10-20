// cues-game.test.js — the Who's next game: teach, quiz, teach one more, quiz. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameBeats, speakersOf, startGame, teachNext, tap, lineNow, BEAT_MAX } from '../src/cues-game-rules.js';

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

test('teach the new line only, then quiz from the start of the beat', () => {
  const beats = [{ start: 0, end: 3 }];
  let game = startGame();
  assert.deepEqual([game.phase, lineNow(game, beats)], ['teach', 0]);
  game = teachNext(game);                                    // line 1 taught → quiz
  assert.deepEqual([game.phase, game.step], ['quiz', 0]);
  assert.equal(tap(startGame(), beats, lines, '1').phase, 'teach', 'no tapping while it teaches');
  game = tap(game, beats, lines, '1');                       // right → teach line 2 only
  assert.deepEqual([game.phase, game.round, lineNow(game, beats)], ['teach', 2, 1]);
  game = teachNext(game);                                    // → quiz lines 1 and 2
  assert.deepEqual([game.phase, game.step], ['quiz', 0]);
  game = tap(tap(game, beats, lines, '1'), beats, lines, '9');
  assert.deepEqual([game.phase, game.round, lineNow(game, beats)], ['teach', 3, 2]);
});

test('a wrong tap teaches just the missed line, then quizzes from the start; the end says done', () => {
  const beats = [{ start: 0, end: 2 }];
  let game = tap(teachNext(startGame()), beats, lines, '1'); // round 1 right
  game = tap(tap(teachNext(game), beats, lines, '1'), beats, lines, '1'); // line 2 wrong: it is Mario
  assert.deepEqual([game.phase, game.mistakes, game.missed.line, lineNow(game, beats)], ['teach', 1, 1, 1]);
  game = teachNext(game);
  assert.deepEqual([game.phase, game.step], ['quiz', 0]);
  game = tap(tap(game, beats, lines, '1'), beats, lines, '9');
  assert.equal(game.done, true);
});
