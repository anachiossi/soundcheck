// cues-timeline.js — the Scene Timeline: the order of speakers as a horizontal track, like a Pro Tools
// session. Each line is a block in the character's colour, with their name, back to back, as long as
// the line — long speeches are capped ("⋯") so the next line, and the start of the one after, are
// always in view: the point is to see who comes next. A fixed cursor (▼) near the left shows where we
// are; ▶ makes the track slide under it paced like a person saying the lines (cues-timeline-rules.js).
//   • − / + speed (0.5× to 2×, remembered) to follow the actors as they run the scene
//   • drag the track to scrub back or forward; tap a block to jump to it (a touch pauses, and it
//     carries on when you let go); ⏮ back to the start
//   • above the track, filling the screen: the whole scene as a script that scrolls by itself, like
//     the lyrics in Spotify (parts/scene-script.js) — the track below is the play bar; "Aa" hides it
//   Full screen, nothing else (Ana: no name pill, no scene bar): a slim row with Cues (from this
//   line) · Map … ✕
// Some day it could follow the actors by listening; for now the speed is by hand.
//   • 🔊 read aloud: ▶ then reads the scene with the film's two voices (a female and a male, Kit →
//     Read aloud), and the cursor and the words follow the real voice (read-aloud.js)
// Used by: main.js (from the Cues tab card and the Scene Map)

import { html, useEffect, useRef, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { timelineBlocks, blockAtTime, wordAtTime, pixelsAt, timeAt } from '../cues-timeline-rules.js';
import { setState } from '../state.js';
import { Icon } from '../parts/icons.js';
import { SceneScript } from '../parts/scene-script.js';
import { voicesReady, phoneVoices, filmVoices, pickVoice, voiceKindOf, speak, unlockSpeech, LINE_PAUSE } from '../read-aloud.js';

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
  const [aloud, setAloud] = useState(() => { try { return localStorage.getItem('sc_timeline_voice') === 'on'; } catch { return false; } });
  const [restart, setRestart] = useState(0);     // +1 = the voice starts again from the cursor (after a jump)
  const timeNow = useRef(0);                     // the cursor's time, for the voice (without re-running it)
  const voiceAt = useRef(null);                  // the end of the line being read: the cursor waits there for the voice
  const stopVoice = useRef(() => {});
  timeNow.current = time;
  useEffect(() => { voicesReady(); }, []); // asks the phone to load its voices

  // a block is never wider than ~40% of what's ahead of the cursor: the current line + the next fit
  const ahead = width * (1 - CURSOR);
  const { blocks, duration } = timelineBlocks(cues?.lines || [], width ? ahead / 2.4 : Infinity);

  // measure the track once it is on screen, and again when the phone turns
  useEffect(() => {
    const box = track.current;
    if (!box) return;
    const measure = () => {
      setWidth(box.clientWidth);
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
          if (aloud) return Math.min(next, voiceAt.current ?? t); // the voice leads, the cursor follows
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
  }, [playing, speed, duration, aloud]);

  // read aloud: say the line under the cursor, from the word under the cursor, then the next lines
  useEffect(() => {
    if (!playing || !aloud || !cues) return;
    let stop = () => {};
    const settings = filmVoices(project);
    const say = (block, fromWord) => {
      if (!block) { setPlaying(false); voiceAt.current = null; return; }
      const voice = pickVoice(phoneVoices(), settings, voiceKindOf(project, block.char_id));
      stop = speak({
        text: cues.lines[block.index].text, voice, language: settings.language, rate: SPEEDS[speed], fromWord,
        onWord: i => {
          voiceAt.current = block.from + block.seconds * 0.98;          // may run to the line's end, not past
          setTime(t => Math.max(t, block.from + block.words[i].start)); // and catches up with the voice's word
        },
        onEnd: () => {
          // a silence first (the cursor waits at the end of the line), then the next line
          const pause = setTimeout(() => {
            const next = blocks[block.index + 1];
            if (next) { setTime(next.from); voiceAt.current = next.from; }
            say(next, 0);
          }, LINE_PAUSE / SPEEDS[speed]);
          stop = () => clearTimeout(pause);
          stopVoice.current = stop;
        },
      });
      stopVoice.current = stop;
    };
    const block = blockAtTime(blocks, timeNow.current);
    say(block, Math.max(0, wordAtTime(block, timeNow.current)));
    return () => { stop(); voiceAt.current = null; };
  }, [playing, aloud, speed, restart]);

  if (!cues) return html`<p class="empty">No lines for scene ${cuesScene}.</p>`;

  const chars = byId(project.characters);
  const colourOf = line => {
    const colour = chars.get(String(line.char_id))?.color;
    return colour && !isNearWhite(colour) ? colour : '#475569';
  };
  const now = blockAtTime(blocks, time);
  const position = pixelsAt(blocks, time);
  // the word being said (each word has its own time: long words and pauses last longer)
  const saying = now ? wordAtTime(now, time) : -1;
  const jumpTo = index => { stopVoice.current(); setTime(blocks[index].from); setRestart(r => r + 1); };
  const toggleText = () => setShowText(on => {
    try { localStorage.setItem('sc_timeline_text', on ? 'off' : 'on'); } catch { /* fine */ }
    return !on;
  });
  const changeSpeed = step => setSpeed(s => {
    const value = Math.min(SPEEDS.length - 1, Math.max(0, s + step));
    try { localStorage.setItem('sc_timeline_speed', String(value)); } catch { /* fine */ }
    return value;
  });

  // touch: drag = scrub (pauses while the finger is down), a tap without moving = jump to that block
  const down = event => {
    held.current = true;
    stopVoice.current();
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
    setTimeout(() => { held.current = false; setRestart(r => r + 1); }, RESUME_AFTER);
  };
  const toggleAloud = () => setAloud(on => {
    try { localStorage.setItem('sc_timeline_voice', on ? 'off' : 'on'); } catch { /* fine */ }
    if (!on) unlockSpeech(); // iOS: the first word must come from a tap
    return !on;
  });

  const cursorX = width * CURSOR;
  return html`
    <div class="timeline">
      <div class="focus-bar">
        <button class="icon-btn" onClick=${() => setState({ screen: 'cues', cuesLine: now?.index || 0, cuesFrom: 'cues-timeline' })}
                aria-label="Cues from this line"><${Icon} name="cues" /></button>
        <button class="icon-btn" onClick=${() => setState({ screen: 'cues-map' })} aria-label="Scene map"><${Icon} name="map" /></button>
        <span class="focus-bar__space"></span>
        <button class=${'icon-btn focus-bar__toggle' + (showText ? ' focus-bar__toggle--on' : '')} onClick=${toggleText}
                aria-label=${showText ? 'Hide the words' : 'Show the words'}>Aa</button>
        <button class=${'icon-btn focus-bar__toggle' + (aloud ? ' focus-bar__toggle--on' : '')} onClick=${toggleAloud}
                aria-label=${aloud ? 'Stop reading aloud' : 'Read aloud'}><${Icon} name="voice" /></button>
        <button class="icon-btn" onClick=${() => setState({ screen: 'cues-picker' })} aria-label="Close"><${Icon} name="close" /></button>
      </div>
      ${showText ? html`<${SceneScript} lines=${cues.lines} current=${now?.index ?? 0} saying=${saying} colourOf=${colourOf} onJump=${jumpTo} />`
        : html`<div class="script"></div>`}
      <div class="timeline__player">

      <div class="auto-scroll timeline__controls">
        <button class="btn" onClick=${() => { stopVoice.current(); setTime(0); setRestart(r => r + 1); }} aria-label="Back to the start">⏮</button>
        <button class="btn btn--primary auto-scroll__play" aria-label=${playing ? 'Pause' : 'Play'}
                onClick=${() => { if (aloud && !playing) unlockSpeech(); if (time >= duration) setTime(0); setPlaying(p => !p); }}>${playing ? '❚❚' : '▶'}</button>
        <span class="auto-scroll__label"></span>
        <button class="btn auto-scroll__step" disabled=${speed === 0} onClick=${() => changeSpeed(-1)} aria-label="Slower">−</button>
        <span class="auto-scroll__speed">${SPEEDS[speed]}×</span>
        <button class="btn auto-scroll__step" disabled=${speed === SPEEDS.length - 1} onClick=${() => changeSpeed(1)} aria-label="Faster">+</button>
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
      </div>
    </div>`;
}
