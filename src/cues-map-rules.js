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

// What happens in one action paragraph, in the script's order: [{ kind, at, people: [{ char_id, name }] }]
// kind: enters · leaves · dies · cries · laughs · screams · whispers · shoots. One event per verb; the people
// of "Ines entra, seguita da Le Favre, Lea e, con passo molto più lento, Luis Miguel" come in three
// groups (Ines · Le Favre and Lea · Luis Miguel): an aside between names starts a new group (Ana, sc. 27).
export function eventsIn(action, characters = []) {
  const names = namesOf(characters);
  const events = [];
  const seen = new Set(); // kind + id: nobody twice for the same thing
  const push = (kind, at, list) => {
    const people = list.map(({ c }) => c).filter(c => !seen.has(kind + c.id)).map(c => { seen.add(kind + c.id); return { char_id: String(c.id), name: c.name }; });
    if (people.length) events.push({ kind, at, people });
  };
  const text = plainText(action).replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' '); // "[50, occhiali…]" "(con fucile)" out
  let last = null;   // the last person named: the subject of "E si accascia…" in the next sentence
  let offset = 0;    // where the sentence starts in the paragraph (for the order)
  for (const sentence of text.split(/(?<=[.!?…;:])/)) {
    const found = names.flatMap(({ word, c }) => [...sentence.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(word)}(?![\\p{L}\\p{N}])`, 'gu'))]
      .map(m => ({ at: m.index, end: m.index + m[0].length, c })))
      .sort((x, y) => x.at - y.at)
      // "prince john" wins over "prince" at the same place
      .filter((f, i, all) => !all.some((g, j) => j !== i && g.at <= f.at && g.end >= f.end && (g.end - g.at) > (f.end - f.at)));
    for (const [kind, verbs] of Object.entries(VERBS)) {
      for (const verb of sentence.matchAll(verbs)) {
        if (/\bnon\s+(\S+\s+)?$/.test(sentence.slice(0, verb.index))) continue; // "Non piange."
        if (verb[1] === 'si accascia' && !DEATH_SIGNS.test(text)) continue;     // crouching, not dying (sc. 48)
        const near = f => sentence.slice(f.end, verb.index).trim().split(/\s+/).filter(Boolean).length <= 6;
        const before = found.filter(f => f.end <= verb.index && (PLURAL.test(verb[1]) || near(f)));
        const after = found.filter(f => f.at > verb.index);
        const lead = sentence.slice(0, verb.index).trim().split(/\s+/).filter(w => w && !LEAD.test(w));
        let who;
        if (PLURAL.test(verb[1])) who = before.length ? before : after;
        else if (before.length) who = [before[before.length - 1]];
        else if (lead.length <= 1 && last) who = [{ c: last }];          // "E si accascia…": the one named before
        else who = after.slice(0, 1);                                       // "appare in cucina MARIO"
        push(kind, offset + verb.index, who);
        // the followers ("seguita da …"), grouped as the script groups them
        const followed = /\bseguit[oaie] da\b/.exec(sentence);
        if (followed && followed.index > verb.index) {
          let group = [], prev = null;
          for (const f of found.filter(x => x.at > followed.index)) {
            const between = prev ? sentence.slice(prev.end, f.at).replace(/[,\s]|\bed?\b/g, '') : '';
            if (between && group.length) { push(kind, offset + group[0].at, group); group = []; }
            group.push(f); prev = f;
          }
          if (group.length) push(kind, offset + group[0].at, group);
        }
      }
    }
    if (found.length) last = found[found.length - 1].c;
    offset += sentence.length;
  }
  return events.sort((x, y) => x.at - y.at);
}

// the same, one row per person: [{ char_id, name, kind }]
export const movesIn = (action, characters = []) =>
  eventsIn(action, characters).flatMap(e => e.people.map(person => ({ ...person, kind: e.kind })));

const nice = name => name.toLowerCase().replace(/(^|[\s'’.-])\p{L}/gu, m => m.toUpperCase()); // MARIO → Mario
const together = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);
const VERB_WORDS = { enters: ['enters', 'enter'], leaves: ['leaves', 'leave'], dies: ['dies', 'die'], cries: ['cries', 'cry'],
  laughs: ['laughs', 'laugh'], screams: ['screams', 'scream'], whispers: ['whispers', 'whisper'], shoots: ['shoots', 'shoot'] };
const said = (people, kind) => `${together(people.map(p => nice(p.name)))} ${VERB_WORDS[kind][people.length > 1 ? 1 : 0]}`;
// "Mario and Helen enter" — everyone with the same kind together (beat titles)
export function movesTitle(moves) {
  return Object.keys(VERB_WORDS).map(kind => {
    const people = moves.filter(m => m.kind === kind);
    return people.length ? said(people, kind) : '';
  }).filter(Boolean).join(' · ');
}
// "Ines enters · Le Favre and Lea enter · Lea screams" — in the script's order (the notes above a line)
export const eventsTitle = events => events.map(e => said(e.people, e.kind)).join(' · ');

// present = the ids of who is in the scene (its mic preset); the speakers count too.
// "Are there" (Ana, 7 Oct): who is in the scene before anything happens — all but those whose first
// event is entering (even in the opening action, before the first line) and who didn't speak before.
// The opening action's events are listed in order above the first line ("Ines enters · Le Favre and Lea
// enter · Luis Miguel enters · Lea screams · Maura, Roy and Oona enter"). Later, a beat starts where
// someone enters, leaves or dies; the sounds are notes above their line.
export function sceneMap(lines, characters = [], present = []) {
  const events = lines.map(line => (line.action ? eventsIn(line.action, characters) : []));
  const firstMove = new Map(); // char id → its first enters / leaves / dies, with the line
  events.forEach((list, index) => list.filter(e => CHANNEL.includes(e.kind)).forEach(e => e.people.forEach(p => {
    if (!firstMove.has(p.char_id)) firstMove.set(p.char_id, { kind: e.kind, index });
  })));
  const spokeAt = new Map();
  lines.forEach((line, index) => { if (line.char_id && !spokeAt.has(String(line.char_id))) spokeAt.set(String(line.char_id), index); });
  const arrives = id => { const m = firstMove.get(id); return m && m.kind === 'enters' && !(spokeAt.get(id) < m.index); };
  const byId = new Map(characters.map(c => [String(c.id), c]));
  const ids = [...new Set([...spokeAt.keys(), ...present.map(String), ...firstMove.keys()])];
  const there = ids.filter(id => byId.has(id) && !arrives(id)).map(id => nice(byId.get(id).name));

  const beats = [];
  let beat = null;
  lines.forEach((line, index) => {
    const words = wordsOf(line.text).length;
    const all = events[index];
    const moves = all.filter(e => CHANNEL.includes(e.kind)).flatMap(e => e.people.map(p => ({ ...p, kind: e.kind })));
    const sounds = all.filter(e => !CHANNEL.includes(e.kind));
    if (!beat || (moves.length && index > 0)) {
      beat = { rows: [], title: index === 0 ? '' : movesTitle(moves) };
      if (index === 0) beat.there = there;
      beats.push(beat);
    }
    beat.rows.push({
      index, name: line.name, char_id: line.char_id, words, long: words >= LONG, moves,
      sounds: sounds.flatMap(e => e.people.map(p => ({ ...p, kind: e.kind }))),
      note: eventsTitle(index === 0 ? all : sounds),   // above the line: the opening in order, later the sounds
      cue: { full: lastSentence(line.text), fast: lastWords(line.text, 4) },
    });
  });
  return beats.map((b, i) => ({ number: i + 1, title: b.title, there: b.there || null, from: b.rows[0].index, to: b.rows.at(-1).index, rows: b.rows }));
}

// ---- 🔍 search (Ana, 7 Oct: on set "we start from WORD" — who said it, and when) ----
// The text cut into pieces, the matches marked: [{ text, hit }]. Capitals and accents don't matter
// ("perche" finds "perché"); the pieces keep the script's own spelling.
export function findIn(text, query) {
  const plain = ch => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const chars = [...String(text)];
  const wanted = [...String(query || '').trim()].map(plain).join('');
  if (!wanted) return [{ text: String(text), hit: false }];
  const flat = chars.map(plain);
  const pieces = [];
  let from = 0;
  for (let i = 0; i < chars.length;) {
    let j = i, got = '';
    while (j < chars.length && got.length < wanted.length && wanted.startsWith(got + flat[j])) got += flat[j++];
    if (got === wanted) {
      if (i > from) pieces.push({ text: chars.slice(from, i).join(''), hit: false });
      pieces.push({ text: chars.slice(i, j).join(''), hit: true });
      i = from = j;
    } else i++;
  }
  if (from < chars.length) pieces.push({ text: chars.slice(from).join(''), hit: false });
  return pieces;
}

// every match of the scene, in order: [{ line, phrase, nth }] (nth = which match inside that phrase)
export function matchesOf(lines, query) {
  const found = [];
  lines.forEach((line, i) => phrasesOf(line.text).forEach((phrase, k) => {
    findIn(phrase, query).filter(p => p.hit).forEach((_, nth) => found.push({ line: i, phrase: k, nth }));
  }));
  return found;
}
