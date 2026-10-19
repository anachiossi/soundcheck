// gear-photos.js — the photos of the kit (Ana, 19 Oct): mostly the makers' official product photos (like the manuals),
// so the crew knows what a "Mini mount beige" or a "Thigh strap extreme" looks like. The film's gear/photos.json:
//   { photos_repo: 'anachiossi/soundcheck-kit-photos',
//     items: { g165: [{ file: 'gear/ursa-minimount-black.jpg', label: 'Ursa MiniMount black', source: 'https://…', note }] },
//     lavs:  { 'DPA 6060': [ … ] },        → by the lav's brand + model
//     txs:   { 'ZMT4.5': [ … ] } }         → by the TX's model
// Identical things share one photo file. The photos live in their own private repo, shared by every film (it is
// Ana's kit, not the film's); each has a small copy in gear/thumbs/.
// Plain data in, plain data out (no network, no screens).
// Used by: photos.js, parts/scene-table.js, parts/gear-form.js

import { scenesSoon, thumbOf } from './costumes.js';

const plain = text => String(text || '').trim().toLowerCase();

// the photos of a Gear thing (strap, pouch, mount…), by its id
export function itemPhotos(project, itemId) {
  return project.gearPhotos?.items?.[itemId] || [];
}

// the photos of a lav's model: "DPA 6060" (brand + model; capitals don't matter)
export function lavPhotos(project, lav) {
  if (!lav) return [];
  const wanted = plain(`${lav.brand || ''} ${lav.model}`);
  const found = Object.entries(project.gearPhotos?.lavs || {}).find(([key]) => plain(key) === wanted);
  return found ? found[1] : [];
}

// the photos of a TX's model: "ZMT4.5"
export function txPhotos(project, tx) {
  if (!tx) return [];
  const found = Object.entries(project.gearPhotos?.txs || {}).find(([key]) => plain(key) === plain(tx.model));
  return found ? found[1] : [];
}

// the connection to the kit photos repo: the film's own key, the photos repo; null when the film has none
export function kitPhotosConnection(project, connection) {
  const [owner, repo] = String(project.gearPhotos?.photos_repo || '').split('/');
  if (!connection || !owner || !repo) return null;
  return { ...connection, owner, repo, branch: 'main' };
}

// The kit photos a phone keeps: every thumbnail, and the full photos of what is rigged from today to the day after
// tomorrow (the accessories, lavs and TXs of those scenes' mic lists). Any other full photo comes when opened.
export function kitPhotosToKeep(project, now = new Date()) {
  const keep = new Set();
  const all = Object.values(project.gearPhotos || {}).filter(group => typeof group === 'object');
  for (const group of all) {
    for (const photos of Object.values(group)) photos.forEach(photo => keep.add(thumbOf(photo.file)));
  }
  const lavs = project.lavaliers || [];
  const txs = project.transmitters || [];
  for (const sceneId of scenesSoon(project, now)) {
    for (const row of project.presets?.[sceneId]?.rows || []) {
      const photos = [
        ...(row.acc || []).flatMap(id => itemPhotos(project, id)),
        ...lavPhotos(project, lavs.find(lav => String(lav.id) === String(row.lav_id))),
        ...txPhotos(project, txs.find(tx => String(tx.id) === String(row.tx_id))),
      ];
      photos.forEach(photo => keep.add(photo.file));
    }
  }
  return [...keep];
}
