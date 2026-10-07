// cues-map-rules.js — the Dialogue map: a scene's order of speakers, in beats. No screen code. Built from
// cueLines(), so the map always follows the lines Cues shows, including the changes made on set (✎).
// Each line may carry the script's action printed before it (line.action, pipeline/read_lines.py).
// Beats (Ana, 7 Oct): a beat starts ONLY where the action says someone enters, leaves or dies
// ("Don't put the action, just enters and leaves the scene. In this case also dies") — titled
// "Mario enters" / "Roy and Helen leave" / "Magnoni dies". No other breaks ("some… mean nothing").
// Sound events (cries, laughs, screams, whispers, shoots) are a note above their line, not a break.
// Who = an Italian verb in the action next to a character's name (movesIn).
//   cue.full / cue.fast: how a line ends (last sentence / last 4 words).
// Used by: screens/cues-map.js

const LONG = 40;

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

// ---- who enters, leaves or dies, from the action (Italian scripts) ----
const plainText = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const VERBS = {
  enters: /\b(entra|entrano|rientra|rientrano|arriva|arrivano|appare|appaiono|compare|compaiono|sopraggiunge|sopraggiungono|irrompe|irrompono|fa irruzione|fanno irruzione|fa il suo ingresso|fanno il loro ingresso|si affaccia|si affacciano)\b/g,
  leaves: /\b(esce|escono|se ne va|se ne vanno|va via|vanno via|si allontana|si allontanano|lascia la stanza|scompare|scompaiono|sparisce|spariscono|corre via|corrono via|fugge|fuggono|scappa|scappano|vengono trascinati fuori|viene trascinat[oa] fuori)\b/g,
  dies: /\b(muore|muoiono|e morto|e morta|cade morto|cade morta|si accascia|stramazza|esala l'ultimo respiro|smette di respirare)\b/g,
  // sound events (Ana, 7 Oct: "all things that can mean something for sound. Like cries, laugh, scream"):
  // a note above the line, no new beat
  cries: /\b(piange|piangono|singhiozza|singhiozzano|scoppia a piangere|scoppiano a piangere|scoppia in lacrime|scoppiano in lacrime)\b/g,
  laughs: /\b(ride|ridono|ridacchia|ridacchiano|sghignazza|sghignazzano|scoppia a ridere|scoppiano a ridere)\b/g,
  screams: /\b(urla|urlano|grida|gridano|strilla|strillano|lancia un urlo|lancia un grido|cacciano un urlo|caccia un urlo)\b/g,
  whispers: /\b(sussurra|sussurrano|bisbiglia|bisbigliano|mormora|mormorano)\b/g,
  shoots: /\b(spara|sparano|fa fuoco|fanno fuoco)\b/g,
};
// "si accascia" is a death only with one of these in the same action (sc. 27 Magnoni: "occhi… all'indietro")
const DEATH_SIGNS = /all'indietro|senza vita|esanime|inerte|non respira|morto|morta|cadavere/;
// enters / leaves / dies open or close a channel: they start a beat. The others are notes on the line.
export const CHANNEL = ['enters', 'leaves', 'dies'];
const PLURAL = /^(entrano|rientrano|arrivano|appaiono|compaiono|sopraggiungono|irrompono|fanno|si affacciano|escono|se ne vanno|vanno|si allontanano|scompaiono|spariscono|corrono|fuggono|scappano|vengono|muoiono|piangono|singhiozzano|scoppiano|ridono|ridacchiano|sghignazzano|urlano|gridano|strillano|cacciano|sussurrano|bisbigliano|mormorano|sparano)/;
const NAME_TITLES = { 'avv.': 'avvocato', 'dott.': 'dottore', 'sig.': 'signor', 'prof.': 'professore' };

// the words that name each character in an action: the name, its aliases, the title written out
// ("AVV. MAGNONI" → "avvocato magnoni"), and the first / last word of a long name when it's nobody
// else's ("PRINCE JOHN" → "prince", "AVV. MAGNONI" → "magnoni")
function namesOf(characters) {
  const parts = c => plainText(c.name).split(/\s+/).filter(Boolean);
  const count = new Map();
  for (const c of characters) for (const w of new Set(parts(c))) count.set(w, (count.get(w) || 0) + 1);
  return characters.flatMap(c => {
    const own = parts(c);
    const words = [c.name, ...(c.aliases || [])].map(plainText).filter(Boolean);
    words.push(own.map(w => NAME_TITLES[w] || w).join(' '));
    for (const w of [own[0], own.at(-1)]) if (w && w.length >= 4 && !NAME_TITLES[w] && count.get(w) === 1) words.push(w);
    return [...new Set(words)].map(word => ({ word, c }));
  });
}

const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEAD = /^(e|ed|poi|ma|quindi|allora|infine|cosi|anche|subito|lentamente)$/;

// [{ char_id, name, kind: 'enters' | 'leaves' | 'dies' }] said by one action paragraph
export function movesIn(action, characters = []) {
  const names = namesOf(characters);
  const moves = [];
  const add = (c, kind) => { if (!moves.some(m => m.char_id === String(c.id) && m.kind === kind)) moves.push({ char_id: String(c.id), name: c.name, kind }); };
  const text = plainText(action).replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' '); // "[50, occhiali…]" "(con fucile)" out
  let last = null; // the last person named: the subject of "E si accascia…" in the next sentence
  for (const sentence of text.split(/[.!?…;:]+/)) {
    const found = names.flatMap(({ word, c }) => [...sentence.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(word)}(?![\\p{L}\\p{N}])`, 'gu'))]
      .map(m => ({ at: m.index, end: m.index + m[0].length, c })));
    for (const [kind, verbs] of Object.entries(VERBS)) {
      for (const verb of sentence.matchAll(verbs)) {
        if (/\bnon\s+(\S+\s+)?$/.test(sentence.slice(0, verb.index))) continue; // "Non piange."
        if (verb[1] === 'si accascia' && !DEATH_SIGNS.test(text)) continue;     // crouching, not dying (sc. 48)
        const near = f => sentence.slice(f.end, verb.index).trim().split(/\s+/).filter(Boolean).length <= 6;
        const before = found.filter(f => f.end <= verb.index && (PLURAL.test(verb[1]) || near(f)));
        const after = found.filter(f => f.at > verb.index);
        const lead = sentence.slice(0, verb.index).trim().split(/\s+/).filter(w => w && !LEAD.test(w));
        let who;
        if (PLURAL.test(verb[1])) who = (before.length ? before : after).sort((a, b) => a.at - b.at); // in the script's order
        else if (before.length) who = [before.sort((a, b) => b.at - a.at)[0]];
        else if (lead.length <= 1 && last) who = [{ c: last }];          // "E si accascia…": the one named before
        else who = after.sort((a, b) => a.at - b.at).slice(0, 1);          // "appare in cucina MARIO"
        who.forEach(({ c }) => add(c, kind));
        // "Ines entra, seguita da Le Favre, Lea e Luis Miguel": the followers too
        const followed = /\bseguit[oaie] da\b/.exec(sentence);
        if (followed && followed.index > verb.index) found.filter(f => f.at > followed.index).forEach(({ c }) => add(c, kind));
      }
    }
    const named = found.sort((a, b) => b.at - a.at)[0];
    if (named) last = named.c;
  }
  return moves;
}

const nice = name => name.toLowerCase().replace(/(^|[\s'’.-])\p{L}/gu, m => m.toUpperCase()); // MARIO → Mario
const together = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);
const VERB_WORDS = { enters: ['enters', 'enter'], leaves: ['leaves', 'leave'], dies: ['dies', 'die'], cries: ['cries', 'cry'],
  laughs: ['laughs', 'laugh'], screams: ['screams', 'scream'], whispers: ['whispers', 'whisper'], shoots: ['shoots', 'shoot'] };
export function movesTitle(moves) {
  return Object.keys(VERB_WORDS).map(kind => {
    const names = moves.filter(m => m.kind === kind).map(m => nice(m.name));
    return names.length ? `${together(names)} ${VERB_WORDS[kind][names.length > 1 ? 1 : 0]}` : '';
  }).filter(Boolean).join(' · ');
}

export function sceneMap(lines, characters = []) {
  const beats = [];
  let beat = null;
  lines.forEach((line, index) => {
    const words = wordsOf(line.text).length;
    const events = line.action ? movesIn(line.action, characters) : [];
    const moves = events.filter(e => CHANNEL.includes(e.kind));   // a channel opens / closes: a new beat
    const sounds = events.filter(e => !CHANNEL.includes(e.kind));  // cries, laughs…: a note on the line
    if (!beat || moves.length) {
      beat = { rows: [], title: moves.length ? movesTitle(moves) : '' };
      beats.push(beat);
    }
    beat.rows.push({
      index, name: line.name, char_id: line.char_id, words, long: words >= LONG, moves, sounds,
      cue: { full: lastSentence(line.text), fast: lastWords(line.text, 4) },
    });
  });
  return beats.map((b, i) => ({ number: i + 1, title: b.title, from: b.rows[0].index, to: b.rows.at(-1).index, rows: b.rows }));
}
