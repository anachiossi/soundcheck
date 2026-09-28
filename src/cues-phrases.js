// cues-phrases.js — to help memorising, every phrase of a speech starts on its own
// line: a new line after each , ; : . ? ! … (not after abbreviations like "Avv."
// or inside numbers like 3.5). No screen code here.
// Used by: screens/cues.js

const ABBREVIATIONS = /\b(avv|dott|dr|sig|sigg|prof|ing|arch|mr|mrs|ms|st|ecc|etc)\.$/i;

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
