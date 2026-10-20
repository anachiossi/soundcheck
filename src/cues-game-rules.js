// cues-game-rules.js — the Who's next game (a "Simon" for Cues): learn the ORDER of speakers in a scene.
// The scene is cut into beats (where someone enters or leaves, cues-map-rules.js), at most 8 lines each.
// Round 1: tap who says line 1. Round 2: lines 1 and 2. Round 3: lines 1, 2, 3… always from the start
// of the beat, like Simon. A wrong tap shows the cue (the end of the line before) and the round starts
// again from the beat's first line. When the whole beat is right, the next beat starts. Silent.
// No screen code here. Used by: screens/cues-game.js

import { sceneMap } from './cues-map-rules.js';

export const BEAT_MAX = 8; // lines in one beat of the game: more is too much to hold in one go

// the scene's beats as line ranges: [{ start, end }] (end not included), none longer than BEAT_MAX
export function gameBeats(lines, characters = [], present = []) {
  const ranges = [];
  for (const beat of sceneMap(lines, characters, present)) {
    const first = beat.rows[0].index;
    const last = beat.rows[beat.rows.length - 1].index + 1;
    for (let start = first; start < last; start += BEAT_MAX) ranges.push({ start, end: Math.min(last, start + BEAT_MAX) });
  }
  return ranges;
}

// the people who speak in the scene, in the order they first speak: the buttons of the game
export function speakersOf(lines) {
  const seen = new Map();
  for (const line of lines) {
    const id = String(line.char_id || line.name);
    if (!seen.has(id)) seen.set(id, { id, char_id: line.char_id, name: line.name });
  }
  return [...seen.values()];
}

export const startGame = () => ({ beat: 0, round: 1, step: 0, mistakes: 0, missed: null, done: false });

// the line Ana has to find now
export const lineNow = (game, beats) => beats[game.beat].start + game.step;

// Ana taps a speaker → the game after that tap
export function tap(game, beats, lines, speakerId) {
  if (game.done) return game;
  const index = lineNow(game, beats);
  const right = String(lines[index].char_id || lines[index].name) === String(speakerId);
  if (!right) return { ...game, step: 0, mistakes: game.mistakes + 1, missed: { line: index } };
  const next = { ...game, step: game.step + 1, missed: null };
  if (next.step < next.round) return next;                       // more lines in this round
  const beatLength = beats[game.beat].end - beats[game.beat].start;
  if (next.round < beatLength) return { ...next, round: next.round + 1, step: 0 }; // one line more
  if (game.beat + 1 < beats.length) return { ...next, beat: game.beat + 1, round: 1, step: 0 };
  return { ...next, done: true };
}
