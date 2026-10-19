// costume-cell.js — the Costume column of the mic table (Ana, 18 Oct): the costume change the character wears in
// this scene ("ch.2", the costume department's number) with a small photo; tap → the photos full screen
// (front, back, detail — none to 3), swipe between them, the change's note and the scenes it is worn in.
// Unknown change → "—". A change with no photo yet still opens (it says so).
// Used by: parts/scene-table.js

import { html, useState } from '../../vendor/preact-htm.js';
import { costumeFor, scenesOfChange, thumbOf } from '../costumes.js';
import { PhotoViewer, usePhoto } from './photo-viewer.js';
import { Icon } from './icons.js';

export function CostumeCell({ project, sceneId, row }) {
  const [open, setOpen] = useState(false);
  const costume = row.char_id ? costumeFor(project, sceneId, row.char_id) : null;
  const first = costume?.photos?.[0]?.file;
  const thumb = usePhoto(project, first && thumbOf(first), false);
  if (!costume) return html`<span class="acc acc--empty">—</span>`;
  const scenes = scenesOfChange(project, costume.char_id, costume.change);
  return html`
    <button class="edit-cell" onClick=${() => setOpen(true)} aria-label=${`Costume ch.${costume.change}`}>
      <span class="pill costume-pill">
        ${thumb ? html`<img class="costume-pill__thumb" src=${thumb} alt="" />` : html`<${Icon} name="costume" />`}
        <b>ch.${costume.change}</b>
      </span>
    </button>
    ${open && html`
      <${PhotoViewer} project=${project} title=${`${row.character?.name || ''} · ch.${costume.change}`}
        photos=${costume.photos || []} close=${() => setOpen(false)}>
        ${costume.note && html`<p>${costume.note}</p>`}
        ${scenes.length > 0 && html`<p class="muted">Worn in ${scenes.map(s => '#' + s).join(' · ')}</p>`}
      <//>`}`;
}
