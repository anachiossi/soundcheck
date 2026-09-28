// icons.js — small drawn icons for buttons (instead of emoji), thin lines in the
// button's own text colour, so they look the same on every phone.
//   <${Icon} name="edit" />   names: edit · mic · image · document · close · up · pin ·
//                              download · inbox · headphones · map
// Used by: the scene bar, Schedule, Cues, Kit, pickers, the top bar.

import { html } from '../../vendor/preact-htm.js';

const DRAWINGS = {
  edit: html`<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" />`,
  mic: html`<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" />`,
  image: html`<rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 8" />`,
  document: html`<path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" />`,
  close: html`<path d="M6 6l12 12M18 6L6 18" />`,
  up: html`<path d="M12 19V5M6 11l6-6 6 6" />`,
  pin: html`<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z" /><circle cx="12" cy="11" r="2" />`,
  download: html`<path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" />`,
  inbox: html`<rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />`,
  map: html`<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" />`,
  headphones: html`<path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="5" height="8" rx="2" /><rect x="16" y="13" width="5" height="8" rx="2" />`,
};

export function Icon({ name, label }) {
  return html`
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" role=${label ? 'img' : null}
         aria-label=${label || null} aria-hidden=${label ? null : 'true'}>
      ${DRAWINGS[name]}
    </svg>`;
}
