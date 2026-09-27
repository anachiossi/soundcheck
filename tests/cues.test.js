// cues.test.js — which lines 🎙 Cues shows for a scene. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cueLines, cuesSummary } from '../src/cues-rules.js';

const speech = (name, text) => ({ name, char_id: '1', text });
const project = { lines: {
  'script/2': { source: 'Script 21.08.26', lines: [speech('INES', 'old words')] },
  'sides/2': { source: 'Sides · Day 6', lines: [speech('INES', 'new words')] },
  'script/7': { source: 'Script 21.08.26', lines: [speech('LEA', 'ciao')] },
  'script/9': { source: 'Script 21.08.26', lines: [] },
} };

test('the day\'s sides win over the script', () => {
  assert.equal(cueLines(project, '2').lines[0].text, 'new words');
});

test('without sides, the script', () => {
  assert.equal(cueLines(project, '7').source, 'Script 21.08.26');
});

test('a part like 7fin uses its base scene, and says so', () => {
  const cues = cueLines(project, '7fin');
  assert.equal(cues.lines[0].name, 'LEA');
  assert.equal(cues.note, 'from scene 7');
});

test('no lines, no Cues', () => {
  assert.equal(cueLines(project, '9'), null);
  assert.equal(cueLines(project, '99'), null);
});

test('summary for the Kit page', () => {
  assert.deepEqual(cuesSummary(project), { script: 3, sides: 1, version: '21.08.26' });
});

import { splitSpeech, scenePages } from '../src/cues-pages.js';
const fitsWords = max => text => text.split(/\s+/).length <= max; // pretend a page holds `max` words

test('a short speech stays on one page', () => {
  assert.deepEqual(splitSpeech('Dai Maura, servila.', fitsWords(10)), ['Dai Maura, servila.']);
});

test('a long speech continues on the next page, cut at the end of a sentence', () => {
  const pages = splitSpeech('Uno due tre. Quattro cinque sei. Sette otto.', fitsWords(6));
  assert.deepEqual(pages, ['Uno due tre. Quattro cinque sei.', 'Sette otto.']);
});

test('one sentence longer than a page is cut between words', () => {
  assert.deepEqual(splitSpeech('a b c d e f g', fitsWords(3)), ['a b c', 'd e f', 'g']);
});

test('pages know their part, the line and who speaks next', () => {
  const pages = scenePages([speech('INES', 'Uno due. Tre quattro.'), speech('ROY', 'Sì.')], fitsWords(2));
  assert.deepEqual(pages.map(p => [p.line, p.part, p.parts, p.nextName]), [[0, 1, 2, 'ROY'], [0, 2, 2, 'ROY'], [1, 1, 1, '']]);
});
