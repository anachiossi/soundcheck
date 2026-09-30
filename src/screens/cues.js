// cues.js — 🎙 Cues: a full-screen mode to learn a scene's lines, one speech per page.
// Looks like a script page (name centred, dialogue in a centred column, Courier Prime),
// made to be easy to read (ideas from dyslexia-friendly reading guides):
//   • one text size for the whole scene (set by the screen size)
//   • every phrase on its own line (cues-phrases.js), a little space between phrases
//   • a long monologue scrolls inside the cream panel; "scroll ▾" shows there is more
//   • the character's colour frames the panel (and the phone's top strip), with the name on it
// Tap the LEFT side → back · anywhere else → forward (a swipe only scrolls).
// After the last line: The end / Start again. The screen stays awake (where allowed).
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
  const textRef = useRef(null);
  const moreBelow = useMoreBelow(textRef, index);
  useWakeLock();
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
    if (editor || event.target.closest('.cues__top, .cues__bottom, .cues__newer')) return; // the bars never turn the page
    const back = event.clientX < innerWidth * 0.3;
    setIndex(i => (back ? Math.max(0, i - 1) : Math.min(lines.length, i + 1)));
  };

  return html`
    <div class="cues" style=${`background:${background};color:${textColourFor(background)};--speaker:${background}`} onClick=${onTap}>
      <div class="cues__top">
        <span>${index + 1} / ${lines.length}</span>
        <span class="cues__scene"><${ScenePill} project=${project} sceneId=${cuesScene} hash /></span>
        <button class="cues__close" onClick=${only(() => setState({ screen: 'cues-map', cuesLine: 0 }))} aria-label="Scene map">
          <${Icon} name="map" /></button>
        <button class="cues__close cues__edit" onClick=${only(() => setEditor({ index, adding: false }))} aria-label="Edit this line">
          <${Icon} name="edit" /></button>
        <button class="cues__close" ...${closeProps(close)} aria-label="Close"><${Icon} name="close" /></button>
      </div>
      ${cues.newer && html`
        <div class="cues__newer">
          <span>New text arrived: ${cues.newer}</span>
          <button class="btn" onClick=${only(() => { backToPaper(cuesScene); setIndex(0); })}>Use it</button>
          <button class="btn" onClick=${only(() => keepEdits(cuesScene))}>Keep my changes</button>
        </div>`}
      <div class="cues__name">${line.name}</div>
      <div class="cues__panel">
        <div class="cues__text" ref=${textRef}>
          <div class="cues__speech">
            ${phraseLines(line.text).split('\n').map((phrase, i) => html`<p class="cues__phrase" key=${i}>${phrase}</p>`)}
          </div>
        </div>
        <div class=${'cues__more' + (moreBelow ? '' : ' cues__more--hidden')}>scroll ▾</div>
      </div>
      <div class="cues__bottom">
        <span>${cues.source}${cues.note ? ` · ${cues.note}` : ''}</span>
        <span>${next ? `next: ${next.name}` : 'last line'}</span>
      </div>
      ${editor && html`<${CueLineEditor} key=${`${index}-${editor.adding}`} project=${project} sceneId=${cuesScene}
        cues=${cues} editor=${editor} setEditor=${setEditor} close=${() => setEditor(null)} goTo=${setIndex} />`}
    </div>`;
}
