// cues-game-rules.js — the Who's next game (a "Simon" for Cues): learn the ORDER of speakers in a scene.
// Like the toy that plays a tune of colours and you play it back, one note longer each time (Ana, 20 Oct:
// "teach, quiz, teach one more, quiz"):
//   TEACH: the app shows the beat's lines one by one, each with who says it (line 1; then 1–2; then 1–2–3…)
//   QUIZ:  Ana taps who says each of those lines, in order
// Right → the next round teaches one line more. Wrong → it says who it was and teaches the round again.
// The scene is cut into beats (where someone enters or leaves, cues-map-rules.js), at most 8 lines each;
// when a beat is learnt, the next one starts. Silent. No screen code here. Used by: screens/cues-game.js

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
    const id = speakerOf(line);
    if (!seen.has(id)) seen.set(id, { id, char_id: line.char_id, name: line.name });
  }
  return [...seen.values()];
}

export const speakerOf = line => String(line.char_id || line.name);

// how long a line stays on screen while teaching: a glance, between 0.3 and 1 second (Ana, 20 Oct: faster, then 3×)
export function teachSeconds(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.min(1, Math.max(0.3, Math.round((0.17 + words * 0.05) * 100) / 100));
}

export const startGame = () => ({ beat: 0, round: 1, phase: 'teach', step: 0, mistakes: 0, missed: null, done: false });

// the line shown (teach) or asked (quiz) now
export const lineNow = (game, beats) => beats[game.beat].start + game.step;

// TEACH: the next line; after the round's last line, the quiz starts from the beat's first line
export function teachNext(game) {
  if (game.phase !== 'teach') return game;
  if (game.step + 1 < game.round) return { ...game, step: game.step + 1 };
  return { ...game, phase: 'quiz', step: 0 };
}

// QUIZ: Ana taps a speaker → the game after that tap
export function tap(game, beats, lines, speakerId) {
  if (game.done || game.phase !== 'quiz') return game;
  const index = lineNow(game, beats);
  if (speakerOf(lines[index]) !== String(speakerId)) {
    return { ...game, phase: 'teach', step: 0, mistakes: game.mistakes + 1, missed: { line: index, tapped: String(speakerId) } };
  }
  const next = { ...game, step: game.step + 1, missed: null };
  if (next.step < next.round) return next;                                   // more lines to tap
  const beatLength = beats[game.beat].end - beats[game.beat].start;
  if (next.round < beatLength) return { ...next, round: next.round + 1, phase: 'teach', step: 0 }; // one line more
  if (game.beat + 1 < beats.length) return { ...next, beat: game.beat + 1, round: 1, phase: 'teach', step: 0 };
  return { ...next, done: true };
}
