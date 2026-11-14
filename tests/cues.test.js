// cues.test.js — which lines 🎙 Cues shows for a scene. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cueLines, cuesSummary } from '../src/cues-rules.js';
import { scriptPage } from '../src/script-page.js';

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

test('lines edited on set win over the paper, and say what they came from', () => {
  const edited = { ...project, lines: { ...project.lines,
    'set/2': { based_on: 'Sides · Day 6', lines: [speech('INES', 'the director\'s words')] } } };
  const cues = cueLines(edited, '2');
  assert.equal(cues.lines[0].text, 'the director\'s words');
  assert.equal(cues.source, 'Sides · Day 6 · edited on set');
  assert.equal(cues.newer, null);
});

test('newer paper after an on-set edit is offered, not forced', () => {
  const edited = { ...project, lines: { ...project.lines,
    'set/2': { based_on: 'Script 21.08.26', lines: [speech('INES', 'mine')] } } };
  const cues = cueLines(edited, '2');
  assert.equal(cues.lines[0].text, 'mine');
  assert.equal(cues.newer, 'Sides · Day 6');
});

test('an emptied on-set file (back to the paper) shows the paper again', () => {
  const back = { ...project, lines: { ...project.lines, 'set/2': { based_on: 'Sides · Day 6', lines: [] } } };
  assert.equal(cueLines(back, '2').lines[0].text, 'new words');
});

// A film whose script can't be used ("lines": "sides_only"): only the sides, never the script
const sidesFilm = { folder: 'projects/x', settings: { lines: 'sides_only' },
  documents: { 'projects/x/docs/day-6/sides.pdf': true },
  lines: {
    'script/2': { source: 'Script Ep1 REV.3', lines: [speech('INES', 'old words')] },
    'script/7': { source: 'Script Ep1 REV.3', pdf: 'docs/scripts/ep1.pdf', page: 3, lines: [speech('LEA', 'another scene')] },
    'sides/2': { source: 'Sides · Day 6', page: 4, lines: [speech('INES', 'new words')] },
    'sides/5C': { source: 'Sides · Day 6', lines: [speech('LEA', 'part C')] },
    'sides/8': { source: 'Sides · Day 6', lines: [speech('LEA', 'whole scene')] },
    'sides/8B': { source: 'Sides · Day 6', lines: [] },
  } };

test('a sides-only film never shows the script, even with no sides for the scene', () => {
  assert.equal(cueLines(sidesFilm, '2').lines[0].text, 'new words');
  assert.equal(cueLines(sidesFilm, '7'), null);
});

test('a part like 5Cfine reads the part the sides print (5C), and says so', () => {
  const cues = cueLines(sidesFilm, '5Cfine');
  assert.equal(cues.lines[0].text, 'part C');
  assert.equal(cues.note, 'from scene 5C');
});

test('a sides-only scene the sides print with no dialogue shows no lines, not the whole scene\'s', () => {
  assert.equal(cueLines(sidesFilm, '8B'), null);
  assert.equal(cueLines(sidesFilm, '8A').note, 'from scene 8');
});

test('in a sides-only film the script button opens the day\'s sides at the scene\'s page', () => {
  assert.deepEqual(scriptPage(sidesFilm, '2'), { path: 'projects/x/docs/day-6/sides.pdf', page: 4,
    title: 'Sc. 2 · Sides Day 6', file: 'Sides_Day_6_2.pdf' });
  assert.equal(scriptPage(sidesFilm, '5C').page, 1); // an older file with no page kept
  assert.equal(scriptPage(sidesFilm, '7'), null);    // no sides: no button (never the script)
});
