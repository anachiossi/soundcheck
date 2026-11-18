// cues-cards.js — the cards of the Dialogs reader (Ana, 18 Nov). Just dialog: one card per speech. Whole scene: the action
// printed before each speech comes first, on grey cards, and the action after the last speech at the end.
// A long action is divided into cards of whole sentences, so it fits a phone at one fixed text size; a sentence too long
// for a card is divided at its commas. The map, the timeline and the game never use these cards: they keep the speeches.
// No screen code here. Used by: screens/cues.js

import { phraseLines, sentencesOf } from './cues-phrases.js';

export const MOST_ON_A_CARD = 300; // when the screen's size is not given

// how many characters fill the white card on this screen, with no scrolling: the text size is --cue-whole-size in app.css;
// the bars around the card take about 240 px, its margins 56 px; lines end early and sentences leave gaps, so 72% of the room
export function cardCapacity(width, height) {
  const size = Math.min(28, Math.max(21, width * 0.06));
  const perLine = Math.floor((width - 56) / (size * 0.6));
  const lines = Math.floor((height - 240) / (size * 1.32));
  return Math.max(120, Math.floor(perLine * lines * 0.72));
}

// a sentence that fits a card, or its phrases
const piecesOf = (sentence, most) => (sentence.length <= most ? [sentence] : phraseLines(sentence).split('\n'));

// the action text → [[sentences of card 1], [sentences of card 2]…]
export function actionPages(text, most = MOST_ON_A_CARD) {
  const pages = [];
  let page = [];
  let size = 0;
  for (const piece of sentencesOf(text).flatMap(sentence => piecesOf(sentence, most))) {
    if (page.length && size + piece.length + 1 > most) {
      pages.push(page);
      page = [];
      size = 0;
    }
    page.push(piece);
    size += piece.length + 1;
  }
  return page.length ? [...pages, page] : pages;
}

// → [{ kind: 'line', line, lineIndex } | { kind: 'action', sentences, lineIndex }]
export function sceneCards(cues, wholeScene, most = MOST_ON_A_CARD) {
  const cards = [];
  const addAction = (text, lineIndex) => {
    if (wholeScene) cards.push(...actionPages(text, most).map(sentences => ({ kind: 'action', sentences, lineIndex })));
  };
  (cues?.lines || []).forEach((line, lineIndex) => {
    addAction(line.action, lineIndex);
    cards.push({ kind: 'line', line, lineIndex });
  });
  addAction(cues?.end_action, (cues?.lines.length || 1) - 1);
  return cards;
}

// where a speech is among the cards
export const cardOfLine = (cards, lineIndex) => Math.max(0, cards.findIndex(card => card.kind === 'line' && card.lineIndex === lineIndex));

// does this scene have anything to show besides the speeches?
export const hasAction = cues => Boolean(cues?.end_action || cues?.lines.some(line => line.action));
