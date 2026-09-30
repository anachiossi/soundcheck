// scene-script.js — the whole scene as a script that scrolls by itself, like the lyrics in Spotify:
// each line is a card (the name centred in capitals, the dialogue in the script font, left-aligned with
// an indent, in a centred column). Lines already said fade, the line being said turns black word by
// word, the lines still to come are grey. It keeps the line being said near the top third; scroll it by
// hand to look ahead or back (it waits a few seconds, then catches up); tap a line to jump there.
// Used by: screens/cues-timeline.js (above the track, which is the play bar)

import { html, useEffect, useRef } from '../../vendor/preact-htm.js';

const WAIT_AFTER_TOUCH = 3000; // ms the script stays where the finger left it

export function SceneScript({ lines, current, saying, colourOf, onJump }) {
  const box = useRef(null);
  const touchedAt = useRef(0);

  // follow: a new line comes up to the top third; inside a long speech, the word being said stays in view
  useEffect(() => {
    const scroller = box.current;
    if (!scroller || Date.now() - touchedAt.current < WAIT_AFTER_TOUCH) return;
    const line = scroller.querySelector('.script-line--now');
    if (!line) return;
    const word = [...line.querySelectorAll('.said')].pop();
    const lineTop = line.offsetTop - scroller.clientHeight * 0.3;
    const wordTop = word ? word.offsetTop - scroller.clientHeight * 0.45 : lineTop;
    scroller.scrollTo({ top: Math.max(lineTop, Math.min(wordTop, line.offsetTop)), behavior: 'smooth' });
  }, [current, saying]);

  const touched = () => { touchedAt.current = Date.now(); };
  const jump = index => { touchedAt.current = 0; onJump(index); };

  return html`
    <div class="script" ref=${box} onTouchStart=${touched} onWheel=${touched}>
      <div class="script__space"></div>
      ${lines.map((line, i) => html`
        <div key=${i} class=${'script-line' + (i < current ? ' script-line--said' : i === current ? ' script-line--now' : '')}
             role="button" onClick=${() => jump(i)}>
          <p class="script-line__name"><span class="script-line__dot" style=${`background:${colourOf(line)}`}></span>${line.name}</p>
          <p class="script-line__text">${i === current
            ? String(line.text).split(/\s+/).filter(Boolean).map((word, w) => html`<span key=${w} class=${w <= saying ? 'said' : 'coming'}>${word}</span>${' '}`)
            : line.text}</p>
        </div>`)}
      <div class="script__space"></div>
    </div>`;
}
