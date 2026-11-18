// cues-cards.test.js — the cards of the Dialogs reader (cues-cards.js): just dialog or the whole scene. Made-up lines. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionPages, cardOfLine, hasAction, MOST_ON_A_CARD, sceneCards } from '../src/cues-cards.js';
import { sentencesOf } from '../src/cues-phrases.js';

const cues = { lines: [{ name: 'ANNA', text: 'Ciao.', action: 'Anna entra.' }, { name: 'BRUNO', text: 'Ehi.' }], end_action: 'Escono.' };
const kinds = cards => cards.map(card => card.kind);

test('just dialog shows only the speeches', () => {
  assert.deepEqual(kinds(sceneCards(cues, false)), ['line', 'line']);
});

test('the whole scene puts each action before its speech and the last action at the end', () => {
  const cards = sceneCards(cues, true);
  assert.deepEqual(kinds(cards), ['action', 'line', 'line', 'action']);
  assert.deepEqual(cards[0].sentences, ['Anna entra.']);
  assert.deepEqual(cards[3].sentences, ['Escono.']);
});

test('a speech keeps its place when the switch changes', () => {
  assert.equal(cardOfLine(sceneCards(cues, false), 1), 1);
  assert.equal(cardOfLine(sceneCards(cues, true), 1), 2);
});

test('sentences stay whole, also after an abbreviation', () => {
  assert.deepEqual(sentencesOf('Il dott. Rossi entra. Mino esce-- Terry resta'), ['Il dott. Rossi entra.', 'Mino esce--', 'Terry resta']);
});

test('a long action is divided into cards that fit, and no sentence is cut', () => {
  const sentence = 'Mino e Terry si guardano sorpresi, poi lentamente si voltano verso la porta.';
  const text = Array(12).fill(sentence).join(' ');
  const pages = actionPages(text);
  assert.ok(pages.length > 1);
  for (const page of pages) assert.ok(page.join(' ').length <= MOST_ON_A_CARD);
  assert.equal(pages.flat().join(' '), text);
});

test('a sentence too long for one card is divided at its commas', () => {
  const text = Array(12).fill('una lunga parte della stessa frase che continua,').join(' ') + ' e finisce.';
  const pages = actionPages(text);
  assert.ok(pages.length > 1);
  assert.equal(pages.flat().join(' '), text);
});

test('a scene with no action has nothing to switch', () => {
  assert.equal(hasAction({ lines: [{ text: 'Ciao.' }] }), false);
  assert.equal(hasAction(cues), true);
  assert.equal(hasAction({ lines: [{ text: 'Ciao.' }], end_action: 'Esce.' }), true);
});
