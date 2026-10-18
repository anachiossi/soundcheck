// costumes.js — the costume changes of a film (Ana, 18 Oct): what each character wears in each scene and its photos.
// The data is the film's costumes.json:
//   { photos_repo: 'anachiossi/la-buona-educazione-photos',
//     changes: [{ char_id: '1', change: 2, note: 'pantaloni lunghi mango', photos: [{ file: 'costumes/ines-ch2.jpg', label: 'front' }] }],
//     scenes: { '26': { '1': 2 } } }                        → in scene 26 Ines wears ch.2
// A change has none to 3 photos (front, back, detail: e.g. where the lav goes). The photos live in their own
// private repo (photos_repo), so the film's data stays light; each has a small copy in costumes/thumbs/.
// Plain data in, plain data out (no network, no screens).
// Used by: costume-photos.js, parts/costume-cell.js

import { shootingDays, localTodayIso } from './model.js';

// the change a character wears in a scene: { char_id, change, note, photos } or null
export function costumeFor(project, sceneId, charId) {
  const change = project.costumes?.scenes?.[sceneId]?.[charId];
  if (!change) return null;
  const found = (project.costumes.changes || []).find(c => String(c.char_id) === String(charId) && c.change === change);
  return found || { char_id: String(charId), change, note: '', photos: [] };
}

// the scenes where a character wears that change, in the film's order
export function scenesOfChange(project, charId, change) {
  return Object.entries(project.costumes?.scenes || {})
    .filter(([, people]) => people[charId] === change).map(([sceneId]) => sceneId)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// the small copy of a photo: costumes/ines-ch1.jpg → costumes/thumbs/ines-ch1.jpg
export const thumbOf = file => file.replace(/^(.*\/)?([^/]+)$/, (whole, folder = '', name) => `${folder}thumbs/${name}`);

// the connection to the photos repo: the film's own key, the photos repo; null when the film has none
export function photosConnection(project, connection) {
  const [owner, repo] = String(project.costumes?.photos_repo || '').split('/');
  if (!connection || !owner || !repo) return null;
  return { ...connection, owner, repo, branch: 'main' };
}

// The photos a phone keeps: every thumbnail (small), and the full photos of the changes worn from today to the
// day after tomorrow (what is about to be rigged). Any other full photo comes when it is opened, with signal.
export function photosToKeep(project, now = new Date()) {
  const today = localTodayIso(now);
  const last = localTodayIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2));
  const soon = new Set(shootingDays(project).filter(d => d.date >= today && d.date <= last)
    .flatMap(d => d.scenes.map(s => String(s.scene_id))));
  const keep = [];
  for (const change of project.costumes?.changes || []) {
    const worn = scenesOfChange(project, change.char_id, change.change).some(id => soon.has(id));
    for (const photo of change.photos || []) {
      keep.push(thumbOf(photo.file));
      if (worn) keep.push(photo.file);
    }
  }
  return keep;
}
