// cues-game.test.js — the Who's next game: teach, quiz, teach one more, quiz. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameBeats, speakersOf, startGame, teachNext, tap, lineNow, teachSeconds, BEAT_MAX } from '../src/cues-game-rules.js';

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

test('teach line 1, quiz line 1, then teach lines 1–2, quiz lines 1–2', () => {
  const beats = [{ start: 0, end: 3 }];
  let game = startGame();
  assert.deepEqual([game.phase, lineNow(game, beats)], ['teach', 0]);
  game = teachNext(game);                                    // line 1 taught → quiz
  assert.deepEqual([game.phase, game.step], ['quiz', 0]);
  assert.equal(tap(startGame(), beats, lines, '1').phase, 'teach', 'no tapping while it teaches');
  game = tap(game, beats, lines, '1');                       // right → teach one more
  assert.deepEqual([game.phase, game.round, game.step], ['teach', 2, 0]);
  game = teachNext(teachNext(game));                         // lines 1 and 2 shown → quiz
  assert.deepEqual([game.phase, game.step], ['quiz', 0]);
  game = tap(tap(game, beats, lines, '1'), beats, lines, '9');
  assert.deepEqual([game.phase, game.round], ['teach', 3]);
});

test('a wrong tap says who it was and teaches the round again; the end says done', () => {
  const beats = [{ start: 0, end: 2 }];
  let game = tap(teachNext(startGame()), beats, lines, '9'); // wrong: line 1 is Ines
  assert.deepEqual([game.phase, game.round, game.step, game.mistakes, game.missed.line], ['teach', 1, 0, 1, 0]);
  game = tap(teachNext(game), beats, lines, '1');
  assert.equal(game.missed, null);
  game = teachNext(teachNext(game));
  game = tap(tap(game, beats, lines, '1'), beats, lines, '9');
  assert.equal(game.done, true);
});

test('a line stays on screen for a glance, 0.3 to 1 second', () => {
  assert.equal(teachSeconds('Ciao.'), 0.3);
  assert.equal(teachSeconds('uno due tre quattro cinque sei sette otto nove dieci'), 0.67);
  assert.equal(teachSeconds('parola '.repeat(40)), 1);
});
