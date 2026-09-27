// cues-pages.js — cuts a scene's speeches into pages of the SAME text size.
// A speech that doesn't fit one page continues on the next, cut at the end of a
// sentence (or, if one sentence alone is too long, between words).
// `fits(text)` answers "does this text fit one page?" (Cues measures it on screen).
// Used by: screens/cues.js

// '… una lasagna. Ieri abbiamo…' → ['… una lasagna.', 'Ieri abbiamo…']; a line break = its own piece
function sentences(text) {
  return text.split('\n').flatMap((paragraph, i, all) => {
    const parts = paragraph.split(/(?<=[.!?…])\s+/).filter(Boolean);
    if (i < all.length - 1 && parts.length) parts[parts.length - 1] += '\n';
    return parts;
  });
}

function joinPieces(a, b) {
  if (!a) return b;
  return a.endsWith('\n') ? a + b : `${a} ${b}`;
}

// One speech → the texts of its pages.
export function splitSpeech(text, fits) {
  const pages = [];
  let current = '';
  const push = () => { if (current.trim()) pages.push(current.trim()); current = ''; };
  for (const sentence of sentences(text)) {
    if (fits(joinPieces(current, sentence))) { current = joinPieces(current, sentence); continue; }
    push();
    if (fits(sentence)) { current = sentence; continue; }
    for (const word of sentence.split(/\s+/)) {  // one sentence longer than a page
      if (current && !fits(joinPieces(current, word))) push();
      current = joinPieces(current, word);
    }
  }
  push();
  return pages.length ? pages : [text];
}

// All the pages of a scene, in order:
// [{ line: 7, part: 1, parts: 2, name, char_id, text, nextName }]
export function scenePages(lines, fits) {
  return lines.flatMap((line, index) => {
    const texts = splitSpeech(line.text, fits);
    return texts.map((text, i) => ({
      line: index, part: i + 1, parts: texts.length, name: line.name, char_id: line.char_id, text,
      nextName: lines[index + 1]?.name || '',
    }));
  });
}
