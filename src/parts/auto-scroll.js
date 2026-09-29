// auto-scroll.js — the page scrolls down by itself (like a teleprompter), for the Scene Map.
//   ▶ / ❚❚ starts and stops; − / + change the speed (remembered on this device).
//   Touch sensitive: a finger on the screen (or the mouse wheel) pauses it — drag back or
//   forward as usual — and it carries on from there a moment after you let go.
//   It stops by itself at the end of the page. The screen stays awake while it runs.
//   While it runs a touch never opens a line (pause with ❚❚ first, then tap the line).
// Used by: screens/cues-map.js

import { html, useEffect, useRef, useState } from '../../vendor/preact-htm.js';

const SPEEDS = [10, 15, 20, 30, 40, 55, 70, 90, 120]; // pixels per second
const RESUME_AFTER = 900; // ms after the finger lifts

function loadSpeed() {
  try { return Math.min(SPEEDS.length - 1, Math.max(0, Number(localStorage.getItem('sc_scroll_speed') ?? 3))); } catch { return 3; }
}

export function AutoScroll() {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(loadSpeed);
  const held = useRef(false);   // a finger is on the screen (or the wheel just moved)
  const resumeTimer = useRef(null);

  const changeSpeed = step => setSpeed(now => {
    const next = Math.min(SPEEDS.length - 1, Math.max(0, now + step));
    try { localStorage.setItem('sc_scroll_speed', String(next)); } catch { /* fine */ }
    return next;
  });

  // the scrolling itself: a little every frame; fractions are saved up (phones only move whole pixels)
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), saved = 0, frame;
    const step = now => {
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!held.current) {
        saved += SPEEDS[speed] * seconds;
        const whole = Math.floor(saved);
        if (whole) { window.scrollBy(0, whole); saved -= whole; }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) return setPlaying(false);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  // touch sensitive: hold = pause, let go = carry on a moment later
  useEffect(() => {
    if (!playing) return;
    const hold = event => {
      if (event.target.closest?.('.auto-scroll')) return; // the controls themselves
      held.current = true;
      clearTimeout(resumeTimer.current);
    };
    const release = () => {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => { held.current = false; }, RESUME_AFTER);
    };
    const wheel = () => { held.current = true; release(); };
    addEventListener('touchstart', hold, { passive: true });
    addEventListener('touchend', release);
    addEventListener('touchcancel', release);
    addEventListener('mousedown', hold);
    addEventListener('mouseup', release);
    addEventListener('wheel', wheel, { passive: true });
    let lock = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    document.body.classList.add('auto-scrolling'); // lines can't be opened while it runs (a touch only pauses)
    return () => {
      document.body.classList.remove('auto-scrolling');
      clearTimeout(resumeTimer.current);
      held.current = false;
      removeEventListener('touchstart', hold);
      removeEventListener('touchend', release);
      removeEventListener('touchcancel', release);
      removeEventListener('mousedown', hold);
      removeEventListener('mouseup', release);
      removeEventListener('wheel', wheel);
      lock?.release?.();
    };
  }, [playing]);

  return html`
    <div class="auto-scroll">
      <button class="btn btn--primary auto-scroll__play" onClick=${() => setPlaying(p => !p)}
              aria-label=${playing ? 'Pause' : 'Scroll by itself'}>${playing ? '❚❚' : '▶'}</button>
      <button class="btn auto-scroll__step" disabled=${speed === 0} onClick=${() => changeSpeed(-1)} aria-label="Slower">−</button>
      <span class="auto-scroll__speed">speed ${speed + 1}</span>
      <button class="btn auto-scroll__step" disabled=${speed === SPEEDS.length - 1} onClick=${() => changeSpeed(1)} aria-label="Faster">+</button>
    </div>`;
}
