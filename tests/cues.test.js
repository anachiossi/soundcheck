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

import { phraseLines } from '../src/cues-phrases.js';

test('every phrase on its own line: after , ; : . ? ! …', () => {
  assert.equal(phraseLines('Guarda qua, fratello: lo spezzatino. Ieri? Sì… buttato insieme.'),
    ['Guarda qua,', 'fratello:', 'lo spezzatino.', 'Ieri?', 'Sì…', 'buttato insieme.'].join('\n'));
});

test('no break after an abbreviation or inside a number', () => {
  assert.equal(phraseLines('Arriva l’Avv. Magnoni con 3.5 milioni.'), 'Arriva l’Avv. Magnoni con 3.5 milioni.');
});
