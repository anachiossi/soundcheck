// cues-map-rules.js — the Scene Map: a scene's order of speakers, in beats, each line
// reduced to its cue (how it ends). No screen code. Built from cueLines(), so the map
// always follows the lines Cues shows, including the changes made on set (✎).
//   cue.full  the last sentence of the line (at most ~16 words)
//   cue.fast  the last 4 words — the emergency version
// Beats (blocks of about 3–8 lines, easier to learn one at a time) start:
//   • when someone speaks for the first time in the scene (an entrance)
//   • before a long speech (40+ words), and always after one
//   • after 8 lines, whatever happens
// Used by: screens/cues-map.js

const LONG = 40;
const MOST = 8;
const FEWEST = 3;

const wordsOf = text => text.split(/\s+/).filter(Boolean);

function lastWords(text, count) {
  const words = wordsOf(text);
  return (words.length > count ? '…' : '') + words.slice(-count).join(' ');
}

// 'Ciao. Come stai? Io bene, grazie.' → 'Io bene, grazie.'
function lastSentence(text) {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.?!…]+[.?!…]*["”’»)]*/g) || [text];
  const last = sentences.map(s => s.trim()).filter(Boolean).pop() || text;
  const words = wordsOf(last);
  if (words.length > 16) return lastWords(last, 16);
  return (sentences.length > 1 ? '…' : '') + last;
}

// A line cut into its phrases, one per row in the Dialogue map (Ana, 7 Oct: "a new line every phrase…
// ':' is still in the same phrase"). A phrase ends at . ? ! … (with any closing quote); a break in the
// script (a stage direction) ends one too. Titles like "Avv." or "Sig." don't end a phrase.
const TITLES = /(?:^|[\s'’])(?:avv|sig|sigg|sig\.ra|dott|dott\.ssa|prof|ing|mr|mrs|ms|dr|st)\.$/i;
export function phrasesOf(text) {
  const phrases = [];
  for (const part of String(text).split(/\n+/)) {
    let current = '';
    for (const piece of part.match(/[^.?!…]+(?:[.?!…]+["”’»)]*|$)/g) || []) {
      current += piece;
      if (/[.?!…]["”’»)]*$/.test(current.trim()) && !TITLES.test(current.trim())) {
        if (current.trim()) phrases.push(current.trim());
        current = '';
      }
    }
    if (current.trim()) phrases.push(current.trim());
  }
  return phrases;
}

export function sceneMap(lines) {
  const beats = [];
  const seen = new Set();
  let beat = null;
  lines.forEach((line, index) => {
    const who = String(line.char_id || line.name);
    const words = wordsOf(line.text).length;
    const long = words >= LONG;
    const entrance = !seen.has(who) && index > 0;
    const afterLong = index > 0 && wordsOf(lines[index - 1].text).length >= LONG;
    const size = beat?.rows.length || 0;
    if (!beat || size >= MOST || afterLong || (size >= FEWEST && (entrance || long))) {
      beat = { rows: [] };
      beats.push(beat);
    }
    seen.add(who);
    beat.rows.push({
      index, name: line.name, char_id: line.char_id, words, long, entrance,
      cue: { full: lastSentence(line.text), fast: lastWords(line.text, 4) },
    });
  });
  return beats.map((b, i) => ({ number: i + 1, from: b.rows[0].index, to: b.rows.at(-1).index, rows: b.rows }));
}
