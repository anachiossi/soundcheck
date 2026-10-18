// costume-cell.js — the Costume column of the mic table (Ana, 18 Oct): the costume change the character wears in
// this scene ("ch.2", the costume department's number) with a small photo; tap → the photos full screen
// (front, back, detail — none to 3), swipe between them, the change's note and the scenes it is worn in.
// Unknown change → "—". A change with no photo yet still opens (it says so).
// Used by: parts/scene-table.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { costumeFor, scenesOfChange, thumbOf } from '../costumes.js';
import { photoNow, photoUrl } from '../costume-photos.js';
import { Icon } from './icons.js';

// a photo's picture address: the thumbnail from the device, or the full photo (fetched if needed); freed when gone
function usePhoto(project, path, full) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    let made = null;
    (full ? photoNow(project, path) : photoUrl(project.id, path)).then(found => {
      made = found;
      if (alive) setUrl(found); else if (found) URL.revokeObjectURL(found);
    });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [project.id, path, full]);
  return url;
}

export function CostumeCell({ project, sceneId, row }) {
  const [open, setOpen] = useState(false);
  const costume = row.char_id ? costumeFor(project, sceneId, row.char_id) : null;
  const first = costume?.photos?.[0]?.file;
  const thumb = usePhoto(project, first && thumbOf(first), false);
  if (!costume) return html`<span class="acc acc--empty">—</span>`;
  return html`
    <button class="edit-cell" onClick=${() => setOpen(true)} aria-label=${`Costume ch.${costume.change}`}>
      <span class="pill costume-pill">
        ${thumb ? html`<img class="costume-pill__thumb" src=${thumb} alt="" />` : html`<${Icon} name="costume" />`}
        <b>ch.${costume.change}</b>
      </span>
    </button>
    ${open && html`<${CostumeViewer} project=${project} costume=${costume} character=${row.character} close=${() => setOpen(false)} />`}`;
}

function CostumePhoto({ project, photo, place }) {
  const full = usePhoto(project, photo.file, true);
  const thumb = usePhoto(project, thumbOf(photo.file), false);
  const shown = full || thumb;
  return html`
    <figure class="costume-viewer__photo">
      ${shown ? html`<img src=${shown} alt=${photo.label} />` : html`<p class="muted">No signal: this photo isn't on the phone yet.</p>`}
      <figcaption>${photo.label}${place && ` · ${place}`}</figcaption>
    </figure>`;
}

function CostumeViewer({ project, costume, character, close }) {
  const scenes = scenesOfChange(project, costume.char_id, costume.change);
  const photos = costume.photos || [];
  return html`
    <div class="costume-viewer" role="dialog" aria-label="Costume">
      <header class="costume-viewer__head">
        <b>${character?.name || ''} · ch.${costume.change}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
      </header>
      ${photos.length
        ? html`<div class="costume-viewer__photos">${photos.map((photo, i) => html`<${CostumePhoto} key=${photo.file} project=${project} photo=${photo}
            place=${photos.length > 1 ? `${i + 1}/${photos.length}` : ''} />`)}</div>`
        : html`<p class="costume-viewer__none">No photo of this costume yet.</p>`}
      <footer class="costume-viewer__foot">
        ${costume.note && html`<p>${costume.note}</p>`}
        ${scenes.length > 0 && html`<p class="muted">Worn in ${scenes.map(s => '#' + s).join(' · ')}</p>`}
        ${project.costumePhotos?.noAccess && html`<p class="muted">This phone's key can't read the photos repo yet.</p>`}
      </footer>
    </div>`;
}
