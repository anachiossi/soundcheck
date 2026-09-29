// cues-timeline.js — the Scene Timeline: the order of speakers as a horizontal track, like a Pro Tools
// session. Each line is a block in the character's colour, with their name, back to back, as long as
// the line — long speeches are capped ("⋯") so the next line, and the start of the one after, are
// always in view: the point is to see who comes next. A fixed cursor (▼) near the left shows where we
// are; ▶ makes the track slide under it paced like a person saying the lines (cues-timeline-rules.js).
//   • − / + speed (0.5× to 2×, remembered) to follow the actors as they run the scene
//   • drag the track to scrub back or forward; tap a block to jump to it (a touch pauses, and it
//     carries on when you let go); ⏮ back to the start
//   • above the track: who speaks now, big, and the next two
//   • under the track: the words, in time with the cursor, like a transcription of a video (said ·
//     now · still to come), and the start of the next line; "Aa" turns the words on / off (remembered)
// Some day it could follow the actors by listening; for now the speed is by hand.
// Used by: main.js (from the Cues tab card and the Scene Map)

import { html, useEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { byId, sceneInfo } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { timelineBlocks, blockAtTime, wordAtTime, pixelsAt, timeAt } from '../cues-timeline-rules.js';
import { setState } from '../state.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const CURSOR = 0.15;      // the cursor sits at 15% of the track: the rest shows what's coming
const RESUME_AFTER = 700; // ms after the finger lifts

function loadSpeed() {
  try { return Math.min(SPEEDS.length - 1, Math.max(0, Number(localStorage.getItem('sc_timeline_speed') ?? 2))); } catch { return 2; }
}

export function CuesTimelineScreen({ state }) {
  const { project, cuesScene } = state;
  const cues = cueLines(project, cuesScene);
  const [time, setTime] = useState(0);            // speaking time (seconds) under the cursor
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(loadSpeed);
  const [width, setWidth] = useState(0);          // the track's width
  const [showText, setShowText] = useState(() => { try { return localStorage.getItem('sc_timeline_text') !== 'off'; } catch { return true; } });
  const held = useRef(false);
  const drag = useRef(null);
  const track = useRef(null);
  const lineBox = useRef(null);

  // the words sit in a fixed 3-line window (so the buttons never move): keep the word being said on
  // its second line, like subtitles, however long the speech
  useEffect(() => {
    const box = lineBox.current;
    const word = box?.querySelector('.saying');
    if (box && word) box.scrollTop = Math.max(0, word.offsetTop - word.offsetHeight * 1.45);
  });
  // a block is never wider than ~40% of what's ahead of the cursor: the current line + the next fit
  const ahead = width * (1 - CURSOR);
  const { blocks, duration } = timelineBlocks(cues?.lines || [], width ? ahead / 2.4 : Infinity);

  // measure the track once it is on screen, and again when the phone turns
  useEffect(() => {
    const box = track.current;
    if (!box) return;
    const measure = () => {
      setWidth(box.clientWidth);
      // phone sideways: bring who-speaks + the track + the controls into view (the header is above)
      if (innerWidth > innerHeight && innerHeight < 520) document.querySelector('.timeline__now')?.scrollIntoView({ block: 'start' });
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(box);
    return () => watcher.disconnect();
  }, [Boolean(cues)]);

  // play: speaking time moves on at the chosen speed; stops at the end
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), frame;
    const step = now => {
      const seconds = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!held.current) {
        setTime(t => {
          const next = t + seconds * SPEEDS[speed];
          if (next >= duration) { setPlaying(false); return duration; }
          return next;
        });
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    let lock = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => { cancelAnimationFrame(frame); lock?.release?.(); };
  }, [playing, speed, duration]);

  if (!cues) return html`<p class="empty">No lines for scene ${cuesScene}.</p>`;

  const chars = byId(project.characters);
  const colourOf = block => {
    const colour = chars.get(String(block.char_id))?.color;
    return colour && !isNearWhite(colour) ? colour : '#475569';
  };
  const now = blockAtTime(blocks, time);
  const upcoming = blocks.slice((now?.index ?? -1) + 1, (now?.index ?? -1) + 3);
  const position = pixelsAt(blocks, time);
  // the words, in time with the cursor (said · now · still to come), like a transcription of a video
  // (each word has its own time: long words and pauses after punctuation last longer)
  const words = now ? now.words.map(w => w.word) : [];
  const saying = now ? wordAtTime(now, time) : -1;
  const nextLine = upcoming[0] ? cues.lines[upcoming[0].index] : null;
  const toggleText = () => setShowText(on => {
    try { localStorage.setItem('sc_timeline_text', on ? 'off' : 'on'); } catch { /* fine */ }
    return !on;
  });
  const info = sceneInfo(project, cuesScene);
  const changeSpeed = step => setSpeed(s => {
    const value = Math.min(SPEEDS.length - 1, Math.max(0, s + step));
    try { localStorage.setItem('sc_timeline_speed', String(value)); } catch { /* fine */ }
    return value;
  });

  // touch: drag = scrub (pauses while the finger is down), a tap without moving = jump to that block
  const down = event => {
    held.current = true;
    drag.current = { x: event.clientX, from: position, moved: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* not a real finger: fine */ }
  };
  const move = event => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    if (drag.current.moved) setTime(timeAt(blocks, Math.max(0, drag.current.from - dx)));
  };
  const up = event => {
    if (drag.current && !drag.current.moved) {
      const box = track.current.getBoundingClientRect();
      const at = position + (event.clientX - box.left - box.width * CURSOR);
      const hit = blocks.find(b => at >= b.start && at < b.start + b.width);
      if (hit) setTime(hit.from);
    }
    drag.current = null;
    setTimeout(() => { held.current = false; }, RESUME_AFTER);
  };

  const cursorX = width * CURSOR;
  return html`
    <div class="timeline">
      <div class="map-head">
        <button class="btn" onClick=${() => setState({ screen: 'cues-map' })}>‹ Map</button>
        <div class="map-head__title">
          <b><${ScenePill} project=${project} sceneId=${cuesScene} hash /> ${info?.set || ''}</b>
          <small>${cues.lines.length} lines · ${cues.source}</small>
        </div>
      </div>

      <div class="timeline__now">
        <span class="timeline__who" style=${now ? `background:${colourOf(now)};color:${textColourFor(colourOf(now))}` : ''}>
          ${now ? now.name : ''}</span>
        <small>${now ? `line ${now.index + 1} of ${blocks.length} · ` : ''}${upcoming.length
          ? `next: ${upcoming.map(b => b.name).join(' → ')}` : 'last line'}</small>
      </div>

      <div class="timeline__track" ref=${track} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
        <div class="timeline__blocks" style=${`transform: translateX(${cursorX - position}px)`}>
          ${blocks.map(block => html`
            <div key=${block.index} class=${'timeline__block' + (block === now ? ' timeline__block--now' : '')}
                 style=${`left:${block.start}px;width:${block.width}px;background:${colourOf(block)};color:${textColourFor(colourOf(block))}`}>
              ${block.name}${block.capped ? ' ⋯' : ''}</div>`)}
        </div>
        <div class="timeline__cursor" style=${`left:${cursorX}px`}><span>▼</span></div>
      </div>

      ${showText && now && html`
        <div class="timeline__text">
          <p class="timeline__line" ref=${lineBox}>${words.map((word, i) => html`
            <span key=${i} class=${i < saying ? 'said' : i === saying ? 'saying' : 'coming'}>${word}</span>${' '}`)}</p>
          <p class="timeline__next">${nextLine ? html`<b>${nextLine.name}:</b> ${nextLine.text}` : '— end of the scene —'}</p>
        </div>`}

      <div class="auto-scroll timeline__controls">
        <button class="btn" onClick=${() => setTime(0)} aria-label="Back to the start">⏮</button>
        <button class="btn btn--primary auto-scroll__play" onClick=${() => { if (time >= duration) setTime(0); setPlaying(p => !p); }}
                aria-label=${playing ? 'Pause' : 'Play'}>${playing ? '❚❚' : '▶'}</button>
        <button class=${'btn timeline__aa' + (showText ? ' timeline__aa--on' : '')} onClick=${toggleText}
                aria-label=${showText ? 'Hide the words' : 'Show the words'}>Aa</button>
        <span class="auto-scroll__label"></span>
        <button class="btn auto-scroll__step" disabled=${speed === 0} onClick=${() => changeSpeed(-1)} aria-label="Slower">−</button>
        <span class="auto-scroll__speed">${SPEEDS[speed]}×</span>
        <button class="btn auto-scroll__step" disabled=${speed === SPEEDS.length - 1} onClick=${() => changeSpeed(1)} aria-label="Faster">+</button>
      </div>
      <p class="muted timeline__hint">Drag the track to go back or forward · tap a block to jump there</p>
    </div>`;
}
