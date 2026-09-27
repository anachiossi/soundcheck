// cues.js — 🎙 Cues: a full-screen mode to learn a scene's lines, one speech per page.
//   • the page is the speaking character's colour, their NAME on top, the words below,
//     as big as the screen allows
//   • tap the LEFT side → previous line · tap anywhere else → next line
//   • corners: 7 / 23 (where you are) and "next: ROY" (who answers)
//   • after the last line: "The end" with ▶ Start again
// The screen stays awake while Cues is open (where the phone allows it).
// Used by: main.js (opened from 🎙 on a scene)

import { html, useEffect, useLayoutEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { setState } from '../state.js';

// Largest font size (px) at which the text still fits its box.
function useFitText(ref, deps) {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let low = 14, high = 160;
    while (high - low > 1) {
      const size = Math.floor((low + high) / 2);
      box.style.fontSize = `${size}px`;
      if (box.scrollHeight <= box.clientHeight && box.scrollWidth <= box.clientWidth) low = size;
      else high = size;
    }
    box.style.fontSize = `${low}px`;
  }, deps);
}

// A button's tap must not also reach the page behind it (which would turn the page).
const only = action => event => { event.stopPropagation(); action(); };

function useWakeLock() {
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => lock?.release?.();
  }, []);
}

export function CuesScreen({ state }) {
  const { project, cuesScene } = state;
  const cues = cueLines(project, cuesScene);
  const [index, setIndex] = useState(0);
  const textRef = useRef(null);
  const [size, setSize] = useState([innerWidth, innerHeight]);
  useEffect(() => {
    const onResize = () => setSize([innerWidth, innerHeight]);
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);
  useWakeLock();
  useFitText(textRef, [index, cuesScene, size[0], size[1]]);

  const close = () => setState({ screen: state.cuesFrom || 'schedule', cuesScene: null });
  if (!cues) return html`<div class="cues cues--end"><p>No lines for scene ${cuesScene}.</p><button class="btn" onClick=${close}>Close</button></div>`;

  const lines = cues.lines;
  const characters = byId(project.characters);
  const atEnd = index >= lines.length;
  const line = lines[Math.min(index, lines.length - 1)];
  const colour = characters.get(String(line.char_id))?.color;
  const background = colour && !isNearWhite(colour) ? colour : '#475569';
  const next = lines[index + 1];

  const onTap = event => {
    const leftSide = event.clientX < innerWidth * 0.3;
    setIndex(i => (leftSide ? Math.max(0, i - 1) : Math.min(lines.length, i + 1)));
  };

  if (atEnd) {
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

  return html`
    <div class="cues" style=${`background:${background};color:${textColourFor(background)}`} onClick=${onTap}>
      <div class="cues__top">
        <span>${index + 1} / ${lines.length}</span>
        <span class="cues__scene">#${cuesScene}</span>
        <button class="cues__close" onClick=${only(close)} aria-label="Close">✕</button>
      </div>
      <div class="cues__name">${line.name}</div>
      <div class="cues__text" ref=${textRef}>${line.text.split('\n').map((part, i) => html`<p key=${i}>${part}</p>`)}</div>
      <div class="cues__bottom">
        <span>${cues.source}${cues.note ? ` · ${cues.note}` : ''}</span>
        <span>${next ? `next: ${next.name}` : 'last line'}</span>
      </div>
    </div>`;
}
