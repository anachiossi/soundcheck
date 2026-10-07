// cues.js — 🎙 Cues: a full-screen mode to learn a scene's lines, one speech per page.
// Looks like a script page (name centred, dialogue in a centred column, Courier Prime),
// made to be easy to read (ideas from dyslexia-friendly reading guides):
//   • one text size for the whole scene (set by the screen size)
//   • every phrase on its own line (cues-phrases.js), a little space between phrases
//   • a long monologue scrolls inside the cream panel; "scroll ▾" shows there is more
//   • the character's colour frames the panel (and the phone's top strip), with the name on it
// Tap the LEFT side → back · anywhere else → forward (a swipe only scrolls).
// After the last line: The end / Start again. The screen stays awake (where allowed).
// iPhone Speak Screen (swipe down with two fingers) reads only the names and the dialogue: everything
// else is aria-hidden. Each line starts with the speaker's name, as a separator (one Siri voice for
// everybody; Ana, 1 Oct), written "Prince John." so the iPhone doesn't spell out capitals.
// It stops when the page turns, so the lines after this one are there too, invisible: it reads from
// this line to the end of the scene in one go (don't tap while it reads).
// The map button opens the Scene Map (cues-map.js). ✎ changes, deletes or adds lines when the director changes them (cue-line-editor.js).
// Used by: main.js (opened from the Cues tab or the microphone on a scene)

import { html, useEffect, useLayoutEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { phraseLines } from '../cues-phrases.js';
import { setState } from '../state.js';
import { backToPaper, keepEdits } from '../cues-editing.js';
import { CueLineEditor } from '../parts/cue-line-editor.js';
import { Icon } from '../parts/icons.js';
import { SearchBar, Marked } from '../parts/line-search.js';
import { voicesReady, phoneVoices, filmVoices, pickVoice, voiceKindOf, speak, unlockSpeech, LINE_PAUSE } from '../read-aloud.js';

// 'PRINCE JOHN' → 'Prince John.' (said as a name, with a stop after it)
const spokenName = name => String(name || '').toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, sep, letter) => sep + letter.toUpperCase()) + '.';

// A button's tap must not also reach the page behind it (which would turn the page).
const only = action => event => { event.stopPropagation(); action(); };

// The ✕ closes as soon as the finger lifts (not on iOS's later "click", which is
// sometimes lost, e.g. while the text is still gliding after a scroll).
const closeProps = close => ({
  onPointerUp: event => { event.stopPropagation(); event.preventDefault(); close(); },
  onClick: event => event.stopPropagation(),
});

// The phone's top strip (clock, battery) takes the speaking character's colour
// while Cues is open, and goes back to the app's colour when it closes.
function useTopStripColour(colour) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const before = meta?.getAttribute('content');
    meta?.setAttribute('content', colour);
    return () => meta?.setAttribute('content', before);
  }, [colour]);
}

function useWakeLock() {
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => lock?.release?.();
  }, []);
}

// Is there more text below? (updated when scrolling, turning the page or resizing)
function useMoreBelow(ref, page) {
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.scrollTop = 0; // each speech starts at its beginning
    const check = () => setMore(box.scrollTop + box.clientHeight < box.scrollHeight - 4);
    check();
    box.addEventListener('scroll', check);
    addEventListener('resize', check);
    document.fonts?.ready.then(check);
    return () => { box.removeEventListener('scroll', check); removeEventListener('resize', check); };
  }, [page]);
  return more;
}

export function CuesScreen({ state }) {
  const { project, cuesScene } = state;
  const cues = cueLines(project, cuesScene);
  const [index, setIndex] = useState(() => Math.min(state.cuesLine || 0, Math.max(0, (cues?.lines.length || 1) - 1)));
  const [editor, setEditor] = useState(null); // { index, adding } while ✎ is open
  const [search, setSearch] = useState(null); // 🔍 { query, at } while the search bar is open
  const textRef = useRef(null);
  const moreBelow = useMoreBelow(textRef, index);
  useWakeLock();
  // 🔊 read aloud: each line with the film's female or male voice, then on to the next page by itself
  const [reading, setReading] = useState(false);
  useEffect(() => { voicesReady(); }, []); // asks the phone to load its voices
  useEffect(() => {
    const line = cues?.lines[index];
    if (!reading || !line) { if (reading && cues && index >= cues.lines.length) setReading(false); return; }
    const settings = filmVoices(project);
    let pause = null; // the silence after the line, then the page turns
    const stop = speak({ text: line.text, language: settings.language,
      voice: pickVoice(phoneVoices(), settings, voiceKindOf(project, line.char_id)),
      onEnd: () => { pause = setTimeout(() => setIndex(i => i + 1), LINE_PAUSE); } });
    return () => { stop(); clearTimeout(pause); };
  }, [reading, index]);
  // (hooks run on every page, so the top strip colour is worked out here, before any return)
  const speaking = cues?.lines[index];
  const speakingColour = byId(project.characters).get(String(speaking?.char_id))?.color;
  const night = document.documentElement.dataset.theme === 'dark'; // dark screen: the top strip stays dark too
  useTopStripColour(night ? '#0b0d10' : speaking ? (speakingColour && !isNearWhite(speakingColour) ? speakingColour : '#475569') : '#0f172a');

  // back to where Cues was opened from (the Scene Map keeps the scene)
  const close = () => setState({ screen: state.cuesFrom || 'cues-picker', cuesLine: 0,
    cuesScene: ['cues-map', 'cues-timeline'].includes(state.cuesFrom) ? cuesScene : null });
  if (!cues) return html`<div class="cues cues--end"><p>No lines for scene ${cuesScene}.</p><button class="btn" onClick=${close}>Close</button></div>`;

  const lines = cues.lines;
  if (index >= lines.length) {
    return html`
      <div class="cues cues--end">
        <p class="cues__source">#${cuesScene} · ${cues.source}${cues.note ? ` · ${cues.note}` : ''}</p>
        <h1>The end</h1>
        <p>${lines.length} lines</p>
        <button class="btn btn--primary cues__again" onClick=${only(() => setIndex(0))}>▶ Start again</button>
        <button class="btn" onClick=${only(() => setIndex(lines.length - 1))}>‹ Last line</button>
        <button class="btn btn--quiet" onClick=${only(close)}>Close</button>
      </div>`;
  }

  const line = lines[index];
  const next = lines[index + 1];
  const colour = byId(project.characters).get(String(line.char_id))?.color;
  const background = colour && !isNearWhite(colour) ? colour : '#475569';
  const onTap = event => {
    if (editor || event.target.closest('.cues__top, .cues__bottom, .cues__newer, .line-search')) return; // the bars never turn the page
    const back = event.clientX < innerWidth * 0.3;
    setIndex(i => (back ? Math.max(0, i - 1) : Math.min(lines.length, i + 1)));
  };

  return html`
    <div class="cues" style=${`background:${background};color:${textColourFor(background)};--speaker:${background}`} onClick=${onTap}>
      <div class="cues__top" aria-hidden="true">
        <span>${index + 1} / ${lines.length}</span>
        <span class="cues__scene"><${ScenePill} project=${project} sceneId=${cuesScene} hash /></span>
        <button class=${'cues__close' + (reading ? ' cues__close--on' : '')} aria-label=${reading ? 'Stop reading aloud' : 'Read aloud'}
                onClick=${only(() => { if (!reading) unlockSpeech(); setReading(!reading); })}><${Icon} name="voice" /></button>
        <button class="cues__close" onClick=${only(() => setSearch(search ? null : { query: '', at: 0 }))} aria-label="Search the lines">
          <${Icon} name="search" /></button>
        <button class="cues__close" onClick=${only(() => setState({ screen: 'cues-map', cuesLine: 0 }))} aria-label="Dialogue map">
          <${Icon} name="map" /></button>
        <button class="cues__close cues__edit" onClick=${only(() => setEditor({ index, adding: false }))} aria-label="Edit this line">
          <${Icon} name="edit" /></button>
        <button class="cues__close" ...${closeProps(close)} aria-label="Close"><${Icon} name="close" /></button>
      </div>
      ${search && html`<${SearchBar} lines=${lines} search=${search} setSearch=${setSearch} onGo=${match => setIndex(match.line)} />`}
      ${cues.newer && html`
        <div class="cues__newer" aria-hidden="true">
          <span>New text arrived: ${cues.newer}</span>
          <button class="btn" onClick=${only(() => { backToPaper(cuesScene); setIndex(0); })}>Use it</button>
          <button class="btn" onClick=${only(() => keepEdits(cuesScene))}>Keep my changes</button>
        </div>`}
      <div class="cues__name" aria-hidden="true"><${Marked} text=${line.name} query=${search?.query} /></div>
      <p class="sr-only">${spokenName(line.name)}</p>
      <div class="cues__panel">
        <div class="cues__text" ref=${textRef}>
          <div class="cues__speech">
            ${phraseLines(line.text).split('\n').map((phrase, i) => html`<p class="cues__phrase" key=${i}><${Marked} text=${phrase} query=${search?.query} /></p>`)}
          </div>
        </div>
        <div class=${'cues__more' + (moreBelow ? '' : ' cues__more--hidden')} aria-hidden="true">scroll ▾</div>
      </div>
      <div class="sr-only">${lines.slice(index + 1).map((later, i) => html`
        <p key=${'n' + i}>${spokenName(later.name)}</p><p key=${'t' + i}>${later.text}</p>`)}</div>
      <div class="cues__bottom" aria-hidden="true">
        <span>${cues.source}${cues.note ? ` · ${cues.note}` : ''}</span>
        <span>${next ? `next: ${next.name}` : 'last line'}</span>
      </div>
      ${editor && html`<${CueLineEditor} key=${`${index}-${editor.adding}`} project=${project} sceneId=${cuesScene}
        cues=${cues} editor=${editor} setEditor=${setEditor} close=${() => setEditor(null)} goTo=${setIndex} />`}
    </div>`;
}
