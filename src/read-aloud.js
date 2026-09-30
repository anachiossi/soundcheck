// read-aloud.js — the scene read aloud with the phone's own voices (the iOS voices: free, and offline
// once downloaded in Settings → Accessibility → Spoken Content → Voices). No screen code.
//   • two voices per film, a female and a male, in the film's language: settings.json →
//     "voices": { "language": "it-IT", "female": "<voice name>", "male": "<voice name>" }
//   • each character says their lines with one of the two: characters.json → "voice": "female" | "male"
//   • a voice chosen on one phone may not exist on another: then the best voice of that language
//     (Premium / Enhanced first) is used instead
// Used by: screens/cues-timeline.js, screens/cues.js, parts/voice-settings.js

const MALE = /\b(luca|marco|paolo|diego|giorgio|pietro|cosimo|eddy|reed|rocko|grandpa|daniel|thomas|jorge|juan|alex|aaron|fred|ralph)\b/i;
const FEMALE = /\b(alice|federica|emma|paola|elsa|isabella|chiara|flo|sandy|shelley|grandma|samantha|karen|amelie|monica|paulina)\b/i;

const synth = () => globalThis.speechSynthesis;

// the phone's voices come a moment after the page opens
export function voicesReady() {
  return new Promise(resolve => {
    const now = synth()?.getVoices() || [];
    if (now.length || !synth()) return resolve(now);
    synth().addEventListener('voiceschanged', () => resolve(synth().getVoices()), { once: true });
    setTimeout(() => resolve(synth().getVoices()), 1500);
  });
}

// the phone's voices right now: asked at each line, because on iOS the list is often still empty when
// the screen opens (then every line fell back to the phone's default voice — a female one)
export const phoneVoices = () => synth()?.getVoices() || [];

export const filmVoices = project => ({ language: 'it-IT', female: '', male: '', ...project.settings?.voices });

// the voices of the film's language, the best first (Premium, then Enhanced)
export function voicesFor(voices, language) {
  const prefix = String(language || 'it').slice(0, 2).toLowerCase();
  const rank = v => (/premium/i.test(v.name) ? 0 : /enhanced|avanzat|migliorat/i.test(v.name) ? 1 : 2);
  return voices.filter(v => String(v.lang).toLowerCase().startsWith(prefix)).sort((a, b) => rank(a) - rank(b));
}

// the voice for 'female' or 'male': the film's choice if this phone has it, else a good guess
export function pickVoice(voices, filmSettings, kind) {
  const mine = voicesFor(voices, filmSettings.language);
  return mine.find(v => v.name === filmSettings[kind])
    || mine.find(v => (kind === 'male' ? MALE : FEMALE).test(v.name))
    || mine.find(v => !(kind === 'male' ? FEMALE : MALE).test(v.name))
    || mine[0] || null;
}

export const voiceKindOf = (project, charId) =>
  project.characters.find(c => String(c.id) === String(charId))?.voice === 'male' ? 'male' : 'female';

// where each word starts in the text, to turn the voice's position (a character index) into a word
export function wordStarts(text) {
  const starts = [];
  String(text || '').replace(/\S+/g, (word, at) => { starts.push(at); return word; });
  return starts;
}

export function wordAtChar(starts, charIndex) {
  let found = 0;
  starts.forEach((start, i) => { if (start <= charIndex) found = i; });
  return found;
}

// say one line, from word `fromWord` on; onWord(index of the word being said), onEnd() when done.
// Returns stop(). (iOS only starts speaking after a tap: the first call must come from a button.)
// iOS sends extra signals: cancelling (to start the next line) can fire a second "end" or an
// "interrupted" error for a line that already ended — which made every sentence start twice.
// So: only the latest line's signals count, each line ends once, and a cancelled line never "ends".
let latest = 0;

export function speak({ text, voice, language, rate = 1, fromWord = 0, onWord = () => {}, onEnd = () => {} }) {
  if (!synth()) { onEnd(); return () => {}; }
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const rest = words.slice(fromWord).join(' ');
  const starts = wordStarts(rest);
  const utterance = new SpeechSynthesisUtterance(rest);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || language;
  utterance.rate = rate;
  const mine = ++latest;
  let finished = false;
  const current = () => mine === latest && !finished;
  const finish = () => { if (current()) { finished = true; onEnd(); } };
  utterance.onboundary = event => { if (current() && event.name !== 'sentence') onWord(fromWord + wordAtChar(starts, event.charIndex)); };
  utterance.onend = finish;
  utterance.onerror = event => { if (!['interrupted', 'canceled'].includes(event?.error)) finish(); };
  if (synth().speaking || synth().pending) synth().cancel();
  onWord(fromWord);
  synth().speak(utterance);
  return () => { if (mine === latest) { latest++; synth().cancel(); } };
}

export const stopSpeaking = () => synth()?.cancel();

// iOS only lets a page speak after a tap: call this inside the tap (▶ or 🔊), the real lines follow later
export function unlockSpeech() {
  if (!synth()) return;
  const silence = new SpeechSynthesisUtterance(' ');
  silence.volume = 0;
  synth().speak(silence);
}
