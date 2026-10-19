// photo-viewer.js — photos full screen: dark, one photo at a time, swipe between them, each with its label
// ("FRONT · 1/2", "Ursa MiniMount black") and, for a maker's photo, the site it came from. Under them a footer
// (the costume's note and scenes…). PhotoTap makes anything tappable to open its photos (a pill in the mic table);
// with no photo it stays as it was. Costume photos and kit photos alike (photos.js finds them).
// Buttons are type="button": a viewer inside a form (the Gear sheet) never submits it.
// Used by: parts/costume-cell.js, parts/scene-table.js, parts/gear-form.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { thumbOf } from '../costumes.js';
import { photoNoAccess, photoNow, photoStamp, photoUrl } from '../photos.js';
import { Icon } from './icons.js';

// a photo's picture address: the thumbnail from the device, or the full photo (fetched if needed); freed when gone
export function usePhoto(project, path, full) {
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
  }, [project.id, path, full, photoStamp(project, path)]); // looks again once the download brings it
  return url;
}

// the site a maker's photo came from, short: "ursastraps.com"
const siteOf = source => { try { return new URL(source).hostname.replace(/^www\./, ''); } catch { return ''; } };

function OnePhoto({ project, photo, place }) {
  const full = usePhoto(project, photo.file, true);
  const thumb = usePhoto(project, thumbOf(photo.file), false);
  const shown = full || thumb;
  return html`
    <figure class="photo-viewer__photo">
      ${shown ? html`<img src=${shown} alt=${photo.label} />` : html`<p class="muted">No signal: this photo isn't on the phone yet.</p>`}
      <figcaption>${photo.label}${place && ` · ${place}`}
        ${photo.source && html`<a class="photo-viewer__source" href=${photo.source} target="_blank" rel="noopener">photo: ${siteOf(photo.source)} ↗</a>`}
      </figcaption>
    </figure>`;
}

export function PhotoViewer({ project, title, photos, close, children }) {
  const noAccess = photos.some(photo => photoNoAccess(project, photo.file));
  return html`
    <div class="photo-viewer" role="dialog" aria-label=${title}>
      <header class="photo-viewer__head">
        <b>${title}</b>
        <button type="button" class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
      </header>
      ${photos.length
        ? html`<div class="photo-viewer__photos">${photos.map((photo, i) => html`<${OnePhoto} key=${photo.file + i} project=${project} photo=${photo}
            place=${photos.length > 1 ? `${i + 1}/${photos.length}` : ''} />`)}</div>`
        : html`<p class="photo-viewer__none">No photo yet.</p>`}
      <footer class="photo-viewer__foot">
        ${children}
        ${noAccess && html`<p class="muted">This phone's key can't read the photos repo yet.</p>`}
      </footer>
    </div>`;
}

// anything with photos becomes a button that opens them; without photos it stays as it is
export function PhotoTap({ project, title, photos, children }) {
  const [open, setOpen] = useState(false);
  if (!photos.length) return children;
  return html`
    <button type="button" class="photo-tap" onClick=${() => setOpen(true)} aria-label=${`Photos: ${title}`}>${children}</button>
    ${open && html`<${PhotoViewer} project=${project} title=${title} photos=${photos} close=${() => setOpen(false)} />`}`;
}
