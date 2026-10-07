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

test('beats start only where someone enters, leaves or dies; sounds are notes on the line', () => {
  const lines = [act('1', 'a', 'Tutti mangiano in cucina.'), say('8', 'b'), act('12', 'c', 'Roy ride.'), act('1', 'd', 'Prince guarda Roy.'),
    act('9', 'e', 'In quel momento appare MARIO.'), say('1', 'f'), act('8', 'g', 'Poi si sente un CLOC. Gli occhi di Mario ruotano all\'indietro. E si accascia.')];
  const beats = sceneMap(lines, cast);
  assert.deepEqual(beats.map(b => [b.from, b.to, b.title]), [[0, 3, ''], [4, 5, 'Mario enters'], [6, 6, 'Mario dies']]);
  assert.equal(movesTitle(beats[0].rows[2].sounds), 'Roy laughs');
  assert.deepEqual(movesIn('Laudomia si ferma. Non piange.', [...cast, { id: '3', name: 'LAUDOMIA' }]), []);
  assert.deepEqual(movesIn('Florin corre. Si accascia.', [...cast, { id: '7', name: 'FLORIN' }]), []); // crouching
  assert.deepEqual(movesIn('Prince John si è piantato sulla soglia e ora la sua mole oscura la luce che arriva dalla cucina.', cast), []);
  assert.equal(movesTitle(movesIn("Laudomia (con fucile) Prince John e l'avvocato Magnoni fanno irruzione nella cella.",
    [...cast, { id: '3', name: 'LAUDOMIA' }, { id: '11', name: 'AVV. MAGNONI' }])), 'Laudomia, Prince John and Avv. Magnoni enter');
  assert.equal(movesTitle(movesIn('Ines entra di corsa, seguita da Roy e Helen.', cast)), 'Ines, Roy and Helen enter');
});

test('a line cut into phrases: at . ? ! …, never at ":" or after a title like Avv.', () => {
  assert.deepEqual(phrasesOf('Guarda qua, fratello: lo spezzatino. Ieri? Sì!'), ['Guarda qua, fratello: lo spezzatino.', 'Ieri?', 'Sì!']);
  assert.deepEqual(phrasesOf('Aspetta… «Vieni.» Ecco'), ['Aspetta…', '«Vieni.»', 'Ecco']);
  assert.deepEqual(phrasesOf("L'Avv. Magnoni è qui. Bene"), ["L'Avv. Magnoni è qui.", 'Bene']);
  assert.deepEqual(phrasesOf('Prima parte\nseconda?!'), ['Prima parte', 'seconda?!']);
});

test('🔍 search: every match, no matter capitals or accents, in the script\'s own spelling', async () => {
  const { findIn, matchesOf } = await import('../src/cues-map-rules.js');
  assert.deepEqual(findIn('Perché? PERCHE no.', 'perche'), [{ text: 'Perché', hit: true }, { text: '? ', hit: false }, { text: 'PERCHE', hit: true }, { text: ' no.', hit: false }]);
  assert.deepEqual(findIn('ciao', ''), [{ text: 'ciao', hit: false }]);
  const lines = [say('1', 'La lasagna. Lasagna!'), say('2', 'Niente'), say('1', 'Ancora lasagna?')];
  assert.deepEqual(matchesOf(lines, 'lasagna'), [{ line: 0, phrase: 0, nth: 0 }, { line: 0, phrase: 1, nth: 0 }, { line: 2, phrase: 0, nth: 0 }]);
  assert.deepEqual(matchesOf([{ name: 'LE FAVRE', text: 'Ciao.' }, say('2', 'Favre!')], 'favre'), [{ line: 0, phrase: -1, nth: 0 }, { line: 1, phrase: 0, nth: 0 }]); // the speaker too
});

test('"Are there" = who is there before anything happens; the opening action listed in order above line 1', () => {
  const lines = [act('1', 'a', 'Ines entra in cucina, seguita da Roy.'), say('8', 'b'), act('9', 'c', 'In quel momento appare MARIO.'), say('1', 'd')];
  const beats = sceneMap(lines, cast, ['1', '8', '9', '12', '13']);
  assert.deepEqual(beats[0].there, ['Prince John', 'Helen']);   // Ines and Roy come in: the opening, in order
  assert.equal(beats[0].rows[0].action, 'Prince John and Helen are there. Ines enters. Roy enters.');
  assert.equal(beats[0].title, '');
  assert.deepEqual(beats.map(b => [b.from, b.to, b.title]), [[0, 1, ''], [2, 3, 'Mario enters']]);
});

test('the script\'s groups: "seguita da Le Favre, Lea e, con passo più lento, Luis Miguel" (sc. 27)', async () => {
  const { eventsIn, eventsTitle } = await import('../src/cues-map-rules.js');
  const people = [...cast, { id: '2', name: 'LE FAVRE' }, { id: '5', name: 'LEA' }, { id: '6', name: 'LUIS MIGUEL' }, { id: '15', name: 'MAURA' }, { id: '14', name: 'OONA' }];
  const action = 'Ines entra di corsa, seguita da Le Favre, Lea e, con passo molto più lento, Luis Miguel. Si bloccano: Lea lancia un grido soffocato. Arrivano anche Maura, Roy e Oona.';
  assert.equal(eventsTitle(eventsIn(action, people)), 'Ines enters · Le Favre and Lea enter · Luis Miguel enters · Lea screams · Maura, Roy and Oona enter');
});
