// read-aloud.test.js — choosing the two voices, and following the voice word by word. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voicesFor, pickVoice, voiceKindOf, wordStarts, wordAtChar, filmVoices } from '../src/read-aloud.js';

const phone = [
  { name: 'Samantha', lang: 'en-US' }, { name: 'Alice', lang: 'it-IT' }, { name: 'Luca', lang: 'it-IT' },
  { name: 'Federica (Premium)', lang: 'it-IT' },
];

test('only the film\'s language, the best voices first', () => {
  assert.deepEqual(voicesFor(phone, 'it-IT').map(v => v.name), ['Federica (Premium)', 'Alice', 'Luca']);
});

test('the film\'s chosen voice when this phone has it, else a good guess of the same kind', () => {
  assert.equal(pickVoice(phone, { language: 'it-IT', female: 'Alice', male: '' }, 'female').name, 'Alice');
  assert.equal(pickVoice(phone, { language: 'it-IT', female: 'Nobody', male: '' }, 'female').name, 'Federica (Premium)');
  assert.equal(pickVoice(phone, { language: 'it-IT', female: '', male: '' }, 'male').name, 'Luca');
  assert.equal(pickVoice([{ name: 'X', lang: 'fr-FR' }], { language: 'it-IT' }, 'male'), null);
});

test('each character speaks with the female or the male voice (female when not set)', () => {
  const project = { characters: [{ id: '1', voice: 'female' }, { id: '8', voice: 'male' }, { id: '9' }] };
  assert.equal(voiceKindOf(project, '8'), 'male');
  assert.equal(voiceKindOf(project, '9'), 'female');
  assert.deepEqual(filmVoices({}), { language: 'it-IT', female: '', male: '' });
});

test('the voice\'s position in the text → the word being said', () => {
  const starts = wordStarts('Dai Maura, servila.');
  assert.deepEqual(starts, [0, 4, 11]);
  assert.equal(wordAtChar(starts, 0), 0);
  assert.equal(wordAtChar(starts, 5), 1);
  assert.equal(wordAtChar(starts, 12), 2);
});
