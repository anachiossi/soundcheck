// cues-timeline-rules.js — the Scene Timeline's layout and timing (no screen code), paced like a
// person really saying the lines:
//   • each word takes as long as its syllables (Italian: one per vowel group — "perché" 2,
//     "lasagna" 3), at about 5.5 syllables a second at speed 1× (acted Italian dialogue)
//   • punctuation breathes: , ; : ≈ 0.25 s · . ? ! ≈ 0.45 s · … ≈ 0.7 s · a dash ≈ 0.3 s
//   • a short breath when the speaker changes (≈ 0.35 s); none when the same person goes on
// Each line is a block on a horizontal track, one right after the other (no gaps), as wide as its
// speaking time — but never more than `maxWidth`, so the current line and the next always fit on
// screen ("⋯" = capped). The cursor moves by speaking time, word by word.
// Used by: screens/cues-timeline.js

export const SYLLABLES_PER_SECOND = 5.5;
export const PX_PER_SECOND = 20;
export const MIN_BLOCK = 34;          // a very short line still shows (the start of) its name
export const TURN = 0.35;             // the breath before a new speaker
const PAUSES = [[/(…|\.\.\.)["”’»)]*$/, 0.7], [/[.?!]["”’»)]*$/, 0.45], [/[,;:]["”’»)]*$/, 0.25], [/^[–—-]$/, 0.3]];

// 'lasagna' → 3 · '‘92' → 4 (numbers are read out: about two syllables a digit)
export function syllables(word) {
  const digits = (word.match(/\d/g) || []).length;
  const vowelGroups = (word.toLowerCase().match(/[aeiouyàèéìíòóùú]+/g) || []).length;
  return Math.max(1, vowelGroups + digits * 2);
}

// one line → its words with their start/end in seconds (at 1×), and the line's length
export function speakWords(text) {
  let at = 0;
  const words = String(text || '').split(/\s+/).filter(Boolean).map(word => {
    const start = at;
    const end = start + syllables(word) / SYLLABLES_PER_SECOND;
    const pause = PAUSES.find(([pattern]) => pattern.test(word))?.[1] || 0;
    at = end + pause;
    return { word, start, end };
  });
  return { words, seconds: Math.max(at, 0.4) };
}

// blocks: [{ index, name, char_id, words, start, width, capped, from, seconds }] (start/width in px,
// from/seconds in speaking time), plus the track's length in px and in seconds
export function timelineBlocks(lines, maxWidth = Infinity) {
  let x = 0, t = 0;
  const blocks = lines.map((line, index) => {
    const spoken = speakWords(line.text);
    const nextSpeaker = lines[index + 1] && String(lines[index + 1].char_id || lines[index + 1].name) !== String(line.char_id || line.name);
    const seconds = spoken.seconds + (nextSpeaker ? TURN : 0);
    const natural = Math.max(MIN_BLOCK, seconds * PX_PER_SECOND);
    const width = Math.min(natural, Math.max(MIN_BLOCK, maxWidth));
    const block = { index, name: line.name, char_id: line.char_id, words: spoken.words, start: x, width,
      capped: width < natural, from: t, seconds };
    x += width;
    t += seconds;
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

// the word being said at `time` inside a block (-1 before the first); after the last word it stays on it
export function wordAtTime(block, time) {
  const into = time - block.from;
  let found = -1;
  block.words.forEach((word, i) => { if (word.start <= into) found = i; });
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
