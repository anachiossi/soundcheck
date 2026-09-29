// cues-timeline-rules.js — the Scene Timeline's layout (no screen code). Each line of the scene is a
// block on a horizontal track, one right after the other (no gaps), like regions in a Pro Tools session.
//   • a block's width follows the line's length (words), but never more than `maxWidth`, so the
//     current line and the next one always fit on screen, with the one after peeking in ("⋯" = capped)
//   • time is true to the words: the cursor moves by speaking time (words ÷ words per second), so it
//     crosses a capped block more slowly — its position in pixels is worked out per block
// Used by: screens/cues-timeline.js

export const PX_PER_WORD = 8;
export const MIN_BLOCK = 34;          // a one-word line still shows (the start of) its name
export const WORDS_PER_SECOND = 2.5;  // speed 1× = normal speech

const wordsOf = text => String(text || '').split(/\s+/).filter(Boolean).length;

// blocks: [{ index, name, char_id, words, start, width, capped, from, seconds }] (start/width in px,
// from/seconds in speaking time), plus the track's length in px and in seconds
export function timelineBlocks(lines, maxWidth = Infinity) {
  let x = 0, t = 0;
  const blocks = lines.map((line, index) => {
    const words = Math.max(1, wordsOf(line.text));
    const natural = Math.max(MIN_BLOCK, words * PX_PER_WORD);
    const width = Math.min(natural, Math.max(MIN_BLOCK, maxWidth));
    const block = { index, name: line.name, char_id: line.char_id, words, start: x, width,
      capped: width < natural, from: t, seconds: words / WORDS_PER_SECOND };
    x += width;
    t += block.seconds;
    return block;
  });
  return { blocks, length: x, duration: t };
}

// the block playing at speaking time `time`
export function blockAtTime(blocks, time) {
  let found = blocks[0] || null;
  for (const block of blocks) {
    if (block.from <= time) found = block;
    else break;
  }
  return found;
}

// speaking time → pixels along the track (and back, for dragging)
export function pixelsAt(blocks, time) {
  const block = blockAtTime(blocks, time);
  if (!block) return 0;
  const share = Math.min(1, Math.max(0, (time - block.from) / block.seconds));
  return block.start + share * block.width;
}

export function timeAt(blocks, pixels) {
  let found = blocks[0] || null;
  for (const block of blocks) {
    if (block.start <= pixels) found = block;
    else break;
  }
  if (!found) return 0;
  const share = Math.min(1, Math.max(0, (pixels - found.start) / found.width));
  return found.from + share * found.seconds;
}
