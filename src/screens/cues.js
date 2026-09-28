// cues.js — 🎙 Cues: a full-screen mode to learn a scene's lines, one speech per page.
// Looks like a script page (name centred, dialogue in a centred column, Courier Prime),
// made to be easy to read (ideas from dyslexia-friendly reading guides):
//   • one text size for the whole scene (set by the screen size)
//   • every phrase on its own line (cues-phrases.js), a little space between phrases
//   • a long monologue scrolls inside the cream panel; "scroll ▾" shows there is more
//   • the character's colour frames the panel, with the name on it
// Tap the LEFT side → back · anywhere else → forward (a swipe only scrolls).
// After the last line: The end / Start again. The screen stays awake (where allowed).
// Used by: main.js (opened from the Cues tab or the microphone on a scene)

import { html, useEffect, useLayoutEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { phraseLines } from '../cues-phrases.js';
import { setState } from '../state.js';
import { Icon } from '../parts/icons.js';

// A button's tap must not also reach the page behind it (which would turn the page).
const only = action => event => { event.stopPropagation(); action(); };

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
  const [index, setIndex] = useState(0);
  const textRef = useRef(null);
  const moreBelow = useMoreBelow(textRef, index);
  useWakeLock();

  const close = () => setState({ screen: state.cuesFrom || 'cues-picker', cuesScene: null });
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
    const back = event.clientX < innerWidth * 0.3;
    setIndex(i => (back ? Math.max(0, i - 1) : Math.min(lines.length, i + 1)));
  };

  return html`
    <div class="cues" style=${`background:${background};color:${textColourFor(background)}`} onClick=${onTap}>
      <div class="cues__top">
        <span>${index + 1} / ${lines.length}</span>
        <span class="cues__scene">#${cuesScene}</span>
        <button class="cues__close" onClick=${only(close)} aria-label="Close"><${Icon} name="close" /></button>
      </div>
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
    </div>`;
}
