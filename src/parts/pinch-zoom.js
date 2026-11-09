// pinch-zoom.js — two fingers zoom the PDF pages only, not the whole screen, so the bar on top (‹ Back, the scene)
// stays the same size (Ana, 9 Nov: "quando faccio zoom … si fa zoom pure in quella barra"). The phone's own zoom is
// turned off on that screen (CSS touch-action on the pages + Safari's "gesturestart"), and the pages get wider instead:
// up to 4×, the point between the fingers stays under the fingers; one finger scrolls, sideways too when zoomed.
// Used by: screens/document.js

import { useEffect, useState } from '../../vendor/preact-htm.js';

const MOST = 4;

const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
const middle = touches => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });

// zoomBox: a ref to the element holding the pages. Returns [zoom, reset].
export function usePinchZoom(zoomBox) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const box = zoomBox.current;
    if (!box) return undefined;
    let current = 1;
    let start = null; // { zoom, distance } while two fingers are down

    const apply = (next, at) => {
      const rect = box.getBoundingClientRect();
      const boxTop = rect.top + window.scrollY;
      // the spot under the fingers, in the pages at zoom 1
      const spotX = (box.scrollLeft + at.x - rect.left) / current;
      const spotY = (window.scrollY + at.y - boxTop) / current;
      current = next;
      box.style.setProperty('--zoom', String(next));
      box.scrollLeft = spotX * next - (at.x - rect.left);
      window.scrollTo(window.scrollX, boxTop + spotY * next - at.y);
    };
    const onStart = event => {
      if (event.touches.length === 2) start = { zoom: current, distance: distance(event.touches) };
    };
    const onMove = event => {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      const next = Math.min(MOST, Math.max(1, start.zoom * distance(event.touches) / start.distance));
      apply(next, middle(event.touches));
    };
    const onEnd = event => {
      if (start && event.touches.length < 2) { start = null; setZoom(current); }
    };
    const noPageZoom = event => event.preventDefault(); // Safari's own pinch (it ignores user-scalable=no)

    box.addEventListener('touchstart', onStart, { passive: true });
    box.addEventListener('touchmove', onMove, { passive: false });
    box.addEventListener('touchend', onEnd);
    box.addEventListener('touchcancel', onEnd);
    document.addEventListener('gesturestart', noPageZoom);
    document.addEventListener('gesturechange', noPageZoom);
    box.resetZoom = () => { current = 1; box.style.setProperty('--zoom', '1'); box.scrollLeft = 0; setZoom(1); };
    return () => {
      box.removeEventListener('touchstart', onStart);
      box.removeEventListener('touchmove', onMove);
      box.removeEventListener('touchend', onEnd);
      box.removeEventListener('touchcancel', onEnd);
      document.removeEventListener('gesturestart', noPageZoom);
      document.removeEventListener('gesturechange', noPageZoom);
    };
  }, []);

  return [zoom, () => zoomBox.current?.resetZoom?.()];
}
