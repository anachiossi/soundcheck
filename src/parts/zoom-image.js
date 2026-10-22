// zoom-image.js — a photo you can zoom with two fingers, inside the photo viewer (photo-viewer.js).
// Pinch to zoom in (up to 5×), drag with one finger to move around, double-tap to go back (or to 2.5×).
// Only the photo zooms: before this the iPhone zoomed the whole app and it stayed zoomed, the viewer's
// title and Close button pushed off the screen (Ana, 22 Oct: "I'm getting stuck in a photos page").
// Not zoomed, a sideways swipe still goes to the next photo.
// Used by: parts/photo-viewer.js

import { html, useRef, useState } from '../../vendor/preact-htm.js';

const MAX_ZOOM = 5;
const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

export function ZoomImage({ src, alt }) {
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const start = useRef(null);
  const lastTap = useRef(0);

  const onTouchStart = event => {
    const touches = event.touches;
    if (touches.length === 2) start.current = { pinch: distance(touches), ...view };
    else if (touches.length === 1) start.current = { fingerX: touches[0].clientX, fingerY: touches[0].clientY, ...view };
  };

  const onTouchMove = event => {
    const touches = event.touches;
    const from = start.current;
    if (!from) return;
    if (touches.length === 2 && from.pinch) {
      event.preventDefault();
      const zoom = Math.min(MAX_ZOOM, Math.max(1, from.zoom * distance(touches) / from.pinch));
      setView(zoom === 1 ? { zoom: 1, x: 0, y: 0 } : { ...view, zoom });
    } else if (touches.length === 1 && view.zoom > 1 && from.fingerX != null) {
      event.preventDefault();
      setView({ ...view, x: from.x + touches[0].clientX - from.fingerX, y: from.y + touches[0].clientY - from.fingerY });
    }
  };

  const onTouchEnd = event => {
    if (event.touches.length > 0) return onTouchStart(event); // one finger left after a pinch: carry on dragging
    start.current = null;
    if (event.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTap.current < 300) setView(view.zoom > 1 ? { zoom: 1, x: 0, y: 0 } : { zoom: 2.5, x: 0, y: 0 });
    lastTap.current = now;
  };

  const zoomed = view.zoom > 1;
  return html`<img src=${src} alt=${alt} class=${'zoom-image' + (zoomed ? ' zoom-image--zoomed' : '')}
    style=${{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
    onTouchStart=${onTouchStart} onTouchMove=${onTouchMove} onTouchEnd=${onTouchEnd} />`;
}
