// cues-phrases.js — to help memorising, every phrase of a speech starts on its own
// line: a new line after each , ; : . ? ! … (not after abbreviations like "Avv."
// or inside numbers like 3.5). sentencesOf: the whole sentences of an action line. No screen code here.
// Used by: screens/cues.js, cues-cards.js

const ABBREVIATIONS = /\b(avv|dott|dr|sig|sigg|prof|ing|arch|mr|mrs|ms|st|ecc|etc)\.$/i;

// 'Mino entra. Terry lo segue--' → ['Mino entra.', 'Terry lo segue--']
export function sentencesOf(text) {
  const sentences = [];
  let current = '';
  for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
    current = current ? `${current} ${word}` : word;
    if (/(?:[.?!…]["”’»)]*|--)$/.test(word) && !ABBREVIATIONS.test(word) && !/^[A-ZÀ-Þ]\.$/.test(word)) {
      sentences.push(current);
      current = '';
    }
  }
  return current ? [...sentences, current] : sentences;
}

// 'Guarda qua, fratello: lo spezzatino.' → one phrase per line
export function phraseLines(text) {
  return text.split('\n').map(paragraph => {
    const pieces = [];
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      current = current ? `${current} ${word}` : word;
      if (/[,;:.?!…]["”’»)]*$/.test(word) && !ABBREVIATIONS.test(word) && !/^[A-ZÀ-Þ]\.$/.test(word)) {
        pieces.push(current);
        current = '';
      }
    }
    if (current) pieces.push(current);
    return pieces.join('\n');
  }).join('\n');
}
