// cues-map.test.js — the Scene Map: cues and beats. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneMap, phrasesOf, movesIn, movesTitle } from '../src/cues-map-rules.js';

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

const cast = [{ id: '1', name: 'INES' }, { id: '8', name: 'PRINCE JOHN' }, { id: '9', name: 'MARIO' }, { id: '12', name: 'ROY' }, { id: '13', name: 'HELEN' }];
const act = (char_id, text, action) => ({ ...say(char_id, text), action });

test('who arrives or leaves comes from the action, next to the name (not from a first line)', () => {
  assert.equal(movesTitle(movesIn('In quel momento appare in cucina MARIO [50, magrissimo].', cast)), 'Mario enters');
  assert.equal(movesTitle(movesIn('Roy ed Helen escono dalla cucina.', cast)), 'Roy and Helen leave');
  assert.equal(movesTitle(movesIn('Prince John prende il piatto e se ne va.', cast)), 'Prince John leaves');
  assert.deepEqual(movesIn('Il RUMORE di una macchina arriva da fuori. Mario riesce a parlare.', cast), []);
});

test('beats start at an arrival / exit, else at an action after 5 lines, never more than 10 lines', () => {
  const lines = [act('1', 'a', 'Tutti mangiano in cucina.'), say('8', 'b'), say('12', 'c'), act('1', 'd', 'Prince guarda Roy.'),
    say('8', 'e'), say('12', 'f'), act('8', 'g', 'Ines si alza.'), act('9', 'h', 'In quel momento appare MARIO.'), say('1', 'i')];
  const beats = sceneMap(lines, cast);
  assert.deepEqual(beats.map(b => [b.from, b.to, b.title]), [[0, 5, 'Tutti mangiano in cucina'], [6, 6, 'Ines si alza'], [7, 8, 'Mario enters']]);
  assert.equal(beats[0].rows[1].moves.length, 0);
  const many = Array.from({ length: 23 }, (_, i) => say(String(i % 2), 'x'));
  assert.deepEqual(sceneMap(many).map(b => b.rows.length), [10, 10, 3]);
});

test('a line cut into phrases: at . ? ! …, never at ":" or after a title like Avv.', () => {
  assert.deepEqual(phrasesOf('Guarda qua, fratello: lo spezzatino. Ieri? Sì!'), ['Guarda qua, fratello: lo spezzatino.', 'Ieri?', 'Sì!']);
  assert.deepEqual(phrasesOf('Aspetta… «Vieni.» Ecco'), ['Aspetta…', '«Vieni.»', 'Ecco']);
  assert.deepEqual(phrasesOf("L'Avv. Magnoni è qui. Bene"), ["L'Avv. Magnoni è qui.", 'Bene']);
  assert.deepEqual(phrasesOf('Prima parte\nseconda?!'), ['Prima parte', 'seconda?!']);
});
