// cues.js — 🎙 Cues: a full-screen mode to learn a scene's lines.
// Made to be easy to read (ideas from dyslexia-friendly reading guides):
//   • ONE text size for the whole scene (set by the screen size, never page by page)
//   • a long speech continues on the next page, cut at the end of a sentence,
//     marked "continues ▸" and "… (continued)"
//   • regular weight, generous line and word spacing, left-aligned, short lines
//   • the words sit on a soft cream panel; the character's colour frames it, with the
//     name centred on top, like a cue in a screenplay
// Tap the LEFT side → back · anywhere else → forward. After the last line: The end / Start again.
// The screen stays awake while Cues is open (where the phone allows it).
// Used by: main.js (opened from the Cues tab or 🎙 on a scene)

import { html, useEffect, useLayoutEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { scenePages } from '../cues-pages.js';
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

function useScreenSize() {
  const [size, setSize] = useState(`${innerWidth}x${innerHeight}`);
  useEffect(() => {
    const onResize = () => setSize(`${innerWidth}x${innerHeight}`);
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);
  return size;
}

export function CuesScreen({ state }) {
  const { project, cuesScene } = state;
  const cues = cueLines(project, cuesScene);
  const [pages, setPages] = useState(null);
  const [index, setIndex] = useState(0);
  const textRef = useRef(null);
  const measureRef = useRef(null);
  const screenSize = useScreenSize();
  useWakeLock();

  // Cut the speeches into pages that fit the text box (again when the screen turns).
  useLayoutEffect(() => {
    const box = textRef.current;
    const measure = measureRef.current;
    if (!cues || !box || !measure) return;
    measure.style.width = `${box.clientWidth}px`;
    const fits = text => {
      measure.textContent = text;
      return measure.scrollHeight <= box.clientHeight;
    };
    const line = pages?.[index]?.line ?? 0;
    const cut = scenePages(cues.lines, fits);
    setPages(cut);
    setIndex(Math.max(0, cut.findIndex(p => p.line === line)));
  }, [cuesScene, screenSize]);

  const close = () => setState({ screen: state.cuesFrom || 'cues-picker', cuesScene: null });
  if (!cues) return html`<div class="cues cues--end"><p>No lines for scene ${cuesScene}.</p><button class="btn" onClick=${close}>Close</button></div>`;

  const total = cues.lines.length;
  if (pages && index >= pages.length) {
    return html`
      <div class="cues cues--end">
        <p class="cues__source">#${cuesScene} · ${cues.source}${cues.note ? ` · ${cues.note}` : ''}</p>
        <h1>The end</h1>
        <p>${total} lines</p>
        <button class="btn btn--primary cues__again" onClick=${only(() => setIndex(0))}>▶ Start again</button>
        <button class="btn" onClick=${only(() => setIndex(pages.length - 1))}>‹ Last line</button>
        <button class="btn btn--quiet" onClick=${only(close)}>Close</button>
      </div>`;
  }

  const page = pages?.[index] || { line: 0, part: 1, parts: 1, ...cues.lines[0], text: '' };
  const colour = byId(project.characters).get(String(page.char_id))?.color;
  const background = colour && !isNearWhite(colour) ? colour : '#475569';
  const onTap = event => {
    const back = event.clientX < innerWidth * 0.3;
    setIndex(i => (back ? Math.max(0, i - 1) : Math.min(pages.length, i + 1)));
  };

  return html`
    <div class="cues" style=${`background:${background};color:${textColourFor(background)}`} onClick=${onTap}>
      <div class="cues__top">
        <span>${page.line + 1} / ${total}${page.parts > 1 ? ` · part ${page.part} of ${page.parts}` : ''}</span>
        <span class="cues__scene">#${cuesScene}</span>
        <button class="cues__close" onClick=${only(close)} aria-label="Close"><${Icon} name="close" /></button>
      </div>
      <div class="cues__name">${page.name}${page.part > 1 ? html` <small>… (continued)</small>` : ''}</div>
      <div class="cues__panel">
        <div class="cues__text" ref=${textRef}>${page.text}</div>
        <div class="cues__text cues__measure" ref=${measureRef} aria-hidden="true"></div>
        <div class=${'cues__continues' + (page.part < page.parts ? '' : ' cues__continues--hidden')}>continues ▸</div>
      </div>
      <div class="cues__bottom">
        <span>${cues.source}${cues.note ? ` · ${cues.note}` : ''}</span>
        <span>${page.part < page.parts ? '' : page.nextName ? `next: ${page.nextName}` : 'last line'}</span>
      </div>
    </div>`;
}
