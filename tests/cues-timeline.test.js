// cues-timeline.test.js — the Scene Timeline, paced like a person saying the lines. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syllables, speakWords, timelineBlocks, blockAtTime, wordAtTime, pixelsAt, timeAt,
  SYLLABLES_PER_SECOND, PX_PER_SECOND, MIN_BLOCK, TURN } from '../src/cues-timeline-rules.js';

const say = (name, text) => ({ name, char_id: name, text });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('a word takes as long as its syllables (Italian vowel groups; numbers are read out)', () => {
  assert.equal(syllables('lasagna'), 3);
  assert.equal(syllables('perché'), 2);
  assert.equal(syllables('Sì.'), 1);
  assert.equal(syllables('‘92'), 4);
});

test('punctuation breathes: a comma a little, a full stop more, "…" the most', () => {
  const comma = speakWords('Dai, Maura').seconds;
  const plain = speakWords('Dai Maura').seconds;
  const stop = speakWords('Dai. Maura').seconds;
  const dots = speakWords('Dai… Maura').seconds;
  assert.ok(plain < comma && comma < stop && stop < dots);
  const { words } = speakWords('Dai Maura');
  close(words[1].start, 1 / SYLLABLES_PER_SECOND);
});

test('a short breath when the speaker changes, none when the same person goes on', () => {
  const { blocks } = timelineBlocks([say('INES', 'Dai'), say('INES', 'Dai'), say('ROY', 'Dai')]);
  close(blocks[0].seconds, speakWords('Dai').seconds);
  close(blocks[1].seconds, speakWords('Dai').seconds + TURN);
});

test('blocks sit back to back, as wide as their speaking time; long ones are capped but keep their time', () => {
  const long = Array(60).fill('parola').join(' ');
  const { blocks } = timelineBlocks([say('INES', long), say('ROY', 'Sì.')], 150);
  assert.equal(blocks[0].width, 150);
  assert.equal(blocks[0].capped, true);
  assert.equal(blocks[1].start, 150, 'no gap');
  assert.equal(blocks[1].width, MIN_BLOCK);
  const free = timelineBlocks([say('INES', 'parola parola parola parola parola')]).blocks[0];
  close(free.width, Math.max(MIN_BLOCK, free.seconds * PX_PER_SECOND));
});

test('the cursor moves by speaking time, word by word', () => {
  const { blocks } = timelineBlocks([say('INES', 'uno due tre'), say('ROY', 'quattro')]);
  const ines = blocks[0];
  assert.equal(blockAtTime(blocks, 0).name, 'INES');
  assert.equal(wordAtTime(ines, 0), 0);
  assert.equal(wordAtTime(ines, ines.words[2].start + 0.01), 2);
  assert.equal(blockAtTime(blocks, ines.seconds + 0.01).name, 'ROY');
  close(timeAt(blocks, pixelsAt(blocks, 0.5)), 0.5);
});
