// cues-timeline.test.js — the Scene Timeline: blocks back to back, long lines capped so the next ones
// stay in view, time true to the words. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timelineBlocks, blockAtTime, pixelsAt, timeAt, PX_PER_WORD, MIN_BLOCK, WORDS_PER_SECOND } from '../src/cues-timeline-rules.js';

const say = (name, words) => ({ name, char_id: name, text: Array(words).fill('parola').join(' ') });

test('blocks sit back to back, as wide as their words (a one-word line still shows its name)', () => {
  const { blocks, length } = timelineBlocks([say('INES', 10), say('ROY', 1)]);
  assert.equal(blocks[0].width, 10 * PX_PER_WORD);
  assert.equal(blocks[1].start, blocks[0].width, 'no gap');
  assert.equal(blocks[1].width, MIN_BLOCK);
  assert.equal(length, 10 * PX_PER_WORD + MIN_BLOCK);
});

test('a long speech is capped so the next lines stay on screen, but keeps its real time', () => {
  const { blocks } = timelineBlocks([say('INES', 100), say('ROY', 5)], 120);
  assert.equal(blocks[0].width, 120);
  assert.equal(blocks[0].capped, true);
  assert.equal(blocks[0].seconds, 100 / WORDS_PER_SECOND);
  assert.equal(blocks[1].start, 120);
});

test('the cursor moves by speaking time: halfway through a capped speech is halfway across its block', () => {
  const { blocks } = timelineBlocks([say('INES', 100), say('ROY', 5)], 120);
  assert.equal(blockAtTime(blocks, 1).name, 'INES');
  assert.equal(pixelsAt(blocks, 20), 60);
  assert.equal(timeAt(blocks, 60), 20);
  assert.equal(blockAtTime(blocks, 41).name, 'ROY');
});
