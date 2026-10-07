// cues-map-rules.js — the Dialogue map: a scene's order of speakers, in beats. No screen code. Built from
// cueLines(), so the map always follows the lines Cues shows, including the changes made on set (✎).
// Each line may carry the script's action printed before it (line.action, pipeline/read_lines.py).
// Beats (Ana, 7 Oct: "explain the action briefly that made you decide"; enters / leaves "only if in the
// scene there is some action of the actor leaving or arriving, not on the first ever line"):
//   • a beat starts where the action says someone arrives or leaves (titled "Mario enters"),
//   • or, after 5 lines, at the next action (titled with the action's first words),
//   • or after 10 lines, whatever happens.
// Who arrives / leaves = an Italian movement verb in the action next to a character's name (movesIn).
//   cue.full / cue.fast: how a line ends (last sentence / last 4 words).
// Used by: screens/cues-map.js

const LONG = 40;
const SOFT = 5;   // after this many lines, any action starts a new beat
const MOST = 10;  // never more lines than this in a beat

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

// ---- who arrives or leaves, from the action (Italian scripts) ----
const plainText = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const ENTERS = /\b(entra|entrano|rientra|rientrano|arriva|arrivano|appare|appaiono|compare|compaiono|sopraggiunge|sopraggiungono|irrompe|irrompono|fa irruzione|fanno irruzione|fa il suo ingresso|si affaccia|si affacciano)\b/g;
const LEAVES = /\b(esce|escono|se ne va|se ne vanno|va via|vanno via|si allontana|si allontanano|lascia la stanza|scompare|scompaiono|sparisce|spariscono|corre via|corrono via|fugge|fuggono|scappa|scappano)\b/g;
const PLURAL = /(ano|ono|anno|ngono)$/;

// the words that name each character in an action: the name, its aliases, and the first word of a long
// name when no one else starts with it ("PRINCE JOHN" → "prince")
function namesOf(characters) {
  const firsts = new Map();
  for (const c of characters) {
    const first = plainText(c.name).split(/\s+/)[0];
    firsts.set(first, firsts.has(first) ? null : c);
  }
  return characters.flatMap(c => {
    const words = [c.name, ...(c.aliases || [])].map(plainText).filter(Boolean);
    const first = plainText(c.name).split(/\s+/)[0];
    if (first.length >= 4 && firsts.get(first) === c) words.push(first);
    return [...new Set(words)].map(word => ({ word, c }));
  });
}

const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// [{ char_id, name, kind: 'enters' | 'leaves' }] said by one action paragraph
export function movesIn(action, characters = []) {
  const names = namesOf(characters);
  const moves = [];
  const text = plainText(action).replace(/\[[^\]]*\]/g, ' '); // "[50, occhiali fumé…]" descriptions out
  for (const sentence of text.split(/[.!?…;]+/)) {
    const found = names.flatMap(({ word, c }) => [...sentence.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(word)}(?![\\p{L}\\p{N}])`, 'gu'))]
      .map(m => ({ at: m.index, c })));
    for (const [kind, verbs] of [['enters', ENTERS], ['leaves', LEAVES]]) {
      for (const verb of sentence.matchAll(verbs)) {
        const who = PLURAL.test(verb[1].split(' ')[0]) || /vanno|fanno/.test(verb[1]) ? found
          : [found.filter(f => f.at < verb.index).sort((a, b) => b.at - a.at)[0]
             || found.filter(f => f.at > verb.index).sort((a, b) => a.at - b.at)[0]].filter(Boolean);
        for (const { c } of who) {
          if (!moves.some(m => m.char_id === String(c.id) && m.kind === kind)) moves.push({ char_id: String(c.id), name: c.name, kind });
        }
      }
    }
  }
  return moves;
}

const nice = name => name.toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, m => m.toUpperCase()); // MARIO → Mario
const together = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);
export function movesTitle(moves) {
  return ['enters', 'leaves'].map(kind => {
    const names = moves.filter(m => m.kind === kind).map(m => nice(m.name));
    return names.length ? `${together(names)} ${names.length > 1 ? (kind === 'enters' ? 'enter' : 'leave') : kind}` : '';
  }).filter(Boolean).join(' · ');
}

// the action's first sentence, at most 9 words: "Prince John prende una fetta con la spatola…"
function actionTitle(action) {
  const first = String(action).replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…:])\s/)[0];
  const words = wordsOf(first);
  return words.length > 9 ? `${words.slice(0, 9).join(' ')}…` : first.replace(/[.:]$/, '');
}

export function sceneMap(lines, characters = []) {
  const beats = [];
  let beat = null;
  lines.forEach((line, index) => {
    const words = wordsOf(line.text).length;
    const action = line.action || '';
    const moves = action ? movesIn(action, characters) : [];
    const size = beat?.rows.length || 0;
    if (!beat || size >= MOST || moves.length || (action && size >= SOFT)) {
      beat = { rows: [], title: moves.length ? movesTitle(moves) : action ? actionTitle(action) : '' };
      beats.push(beat);
    }
    beat.rows.push({
      index, name: line.name, char_id: line.char_id, words, long: words >= LONG, moves,
      cue: { full: lastSentence(line.text), fast: lastWords(line.text, 4) },
    });
  });
  return beats.map((b, i) => ({ number: i + 1, title: b.title, from: b.rows[0].index, to: b.rows.at(-1).index, rows: b.rows }));
}
