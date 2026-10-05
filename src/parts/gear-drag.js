// gear-drag.js — press, hold and drag a thing of the Gear inventory into a cart or case (Ana, 5 Oct).
// Hold the colour square or the name ~½ s until the row lifts, drag it over a case (it lights up; a
// closed case opens after a moment), let go: it moves there with everything it holds. Over a loose
// thing = into the case that thing is in; over "Out of every case" (top of the list) = on its own.
// A case can't go into itself or into something it holds. The page scrolls near the top / bottom edge.
// Written by hand because the browser's own drag and drop doesn't work with a finger on iPhone.
//   const drag = useGearDrag(project, { open, move })
//   drag.hold(item)    → props for the square / name: onPointerDown, onContextMenu
//   drag.dragging      → the item being dragged (or null) · drag.target → the id it would go into
//   drag.wasDrag()     → true right after a drop (so the name's tap doesn't open the sheet)
//   drag.ghost         → the floating name that follows the finger
// Used by: screens/gear.js (Inventory)

import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { containersOf } from '../gear-rules.js';

const HOLD_MS = 450;  // how long to hold before the row lifts
const SLOP = 8;       // moving more than this before then = scrolling, not a drag
const OPEN_MS = 700;  // hovering over a closed case this long opens it
const EDGE = 70;      // the page scrolls when the finger is this close to the top / bottom

export function useGearDrag(project, { open, move }) {
  const [drag, setDrag] = useState(null); // { item, x, y, target, allowed }
  const live = useRef({ drag: null, press: null, hover: null, hoverTimer: 0, dropped: 0 });
  live.current.drag = drag;
  live.current.project = project;
  live.current.open = open;
  live.current.move = move;

  useEffect(() => {
    const now = live.current;
    const targetAt = (x, y, allowed) => {
      const spot = document.elementFromPoint(x, y)?.closest('[data-drop]');
      if (!spot) return null;
      const id = spot.dataset.drop;
      return id === '' || allowed.has(id) ? id : null;
    };
    const hoverOpen = target => {
      if (target === now.hover) return;
      clearTimeout(now.hoverTimer);
      now.hover = target;
      if (target) now.hoverTimer = setTimeout(() => now.open(target), OPEN_MS);
    };
    const end = () => {
      clearTimeout(now.press?.timer);
      clearTimeout(now.hoverTimer);
      now.press = null;
      now.hover = null;
      setDrag(null);
    };
    const onMove = e => {
      if (now.press && !now.drag && Math.hypot(e.clientX - now.press.x, e.clientY - now.press.y) > SLOP) end();
      if (!now.drag) return;
      const target = targetAt(e.clientX, e.clientY, now.drag.allowed);
      hoverOpen(target);
      setDrag(d => d && { ...d, x: e.clientX, y: e.clientY, target });
    };
    const onUp = () => {
      const d = now.drag;
      if (d) {
        now.dropped = Date.now();
        if (d.target !== null && d.target !== (d.item.inside || '')) {
          now.move(d.item.id, d.target);
          if (d.target) now.open(d.target, true);
        }
      }
      end();
    };
    // while dragging, the page must not scroll under the finger (iOS asks every touchmove)
    const noScroll = e => { if (now.drag) e.preventDefault(); };
    let frame;
    const edgeScroll = () => {
      const d = now.drag;
      if (d && d.y < EDGE && d.target !== '') window.scrollBy(0, -10); // not while over "Out of every case"
      else if (d && d.y > window.innerHeight - EDGE) window.scrollBy(0, 10);
      frame = requestAnimationFrame(edgeScroll);
    };
    frame = requestAnimationFrame(edgeScroll);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    document.addEventListener('touchmove', noScroll, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', end);
      document.removeEventListener('touchmove', noScroll);
      end();
    };
  }, []);

  const hold = item => ({
    onPointerDown: e => {
      const now = live.current;
      clearTimeout(now.press?.timer);
      const start = { x: e.clientX, y: e.clientY };
      now.press = {
        ...start,
        timer: setTimeout(() => {
          now.press = null;
          navigator.vibrate?.(10);
          const allowed = new Set(containersOf(now.project, item.id).map(box => box.id));
          setDrag({ item, ...start, target: null, allowed });
        }, HOLD_MS),
      };
    },
    onContextMenu: e => e.preventDefault(), // no iOS / desktop menu on the long press
  });

  const ghost = drag && html`<div class="gear-ghost" style=${`left:${drag.x}px;top:${drag.y}px`}>${drag.item.name}</div>`;
  return {
    hold, ghost,
    dragging: drag?.item || null,
    target: drag ? drag.target : null,
    wasDrag: () => Date.now() - live.current.dropped < 400,
  };
}
