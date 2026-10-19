// photos.js — brings photos from the private photo repos onto this device: the film's costume photos (costumes.js)
// and the kit photos (gear-photos.js). Every thumbnail, and the full photos of the next days. Runs after each sync,
// in the background: no signal, or a key that can't read a photos repo, never stops anything (the cells just show
// no photo). A full photo not on the device yet is fetched when it is opened (photoNow).
// Each source remembers what it brought in the device's copy of the film: project.costumePhotos / project.kitPhotos
// = { files: { path: sha }, noAccess }.
// Used by: sync.js, parts/photo-viewer.js, parts/costume-cell.js

import * as github from './store/github.js';
import { loadPhoto, savePhoto } from './store/local.js';
import { photosConnection, photosToKeep } from './costumes.js';
import { kitPhotosConnection, kitPhotosToKeep } from './gear-photos.js';
import { getState } from './state.js';
import { connectionFor } from './film-source.js';

const COSTUMES = { key: 'costumePhotos', connectionOf: photosConnection, toKeep: photosToKeep };
const KIT = { key: 'kitPhotos', connectionOf: kitPhotosConnection, toKeep: kitPhotosToKeep };

// which repo a photo comes from: the kit photos are all in gear/, the costume photos in costumes/
// (no path yet, e.g. a costume with no photo → costumes, harmless)
const sourceOf = path => (String(path || '').startsWith('gear/') ? KIT : COSTUMES);

// after a sync: the photos to keep from every photos repo, when new or changed
export async function downloadPhotos(connection, store) {
  for (const source of [COSTUMES, KIT]) await downloadFrom(source, connection, store);
}

async function downloadFrom(source, connection, store) {
  const project = store.read();
  const photos = source.connectionOf(project, connection);
  if (!photos) return;
  let tree;
  try {
    tree = await github.readTree(photos);
  } catch (error) {
    if (error.status === 403 || error.status === 404) await store.save({ ...store.read(), [source.key]: { ...project[source.key], noAccess: true } });
    return;
  }
  const files = { ...project[source.key]?.files };
  for (const path of source.toKeep(project)) {
    const sha = tree.files[path];
    if (!sha || files[path] === sha) continue;
    await savePhoto(project.id, path, await github.readFileBytes(photos, sha));
    files[path] = sha;
  }
  await store.save({ ...store.read(), [source.key]: { files, noAccess: false } });
}

// what the background download knows about a photo (its sha): changes when the photo arrives, so pictures look again
export const photoStamp = (project, path) => project[sourceOf(path).key]?.files?.[path];

// true when this device's key can't read the photos repo of that photo
export const photoNoAccess = (project, path) => Boolean(project[sourceOf(path).key]?.noAccess);

// A photo as a picture address for <img>, from the device; null when it isn't here.
// The caller frees it with URL.revokeObjectURL when the picture is gone.
export async function photoUrl(projectId, path) {
  const blob = await loadPhoto(projectId, path).catch(() => null);
  return blob ? URL.createObjectURL(blob) : null;
}

// A photo opened now: from the device, else straight from GitHub (and kept for next time); null offline.
export async function photoNow(project, path) {
  const here = await photoUrl(project.id, path);
  if (here || !navigator.onLine) return here;
  const photos = sourceOf(path).connectionOf(project, connectionFor(project, getState().connection));
  if (!photos) return null;
  try {
    const tree = await github.readTree(photos);
    if (!tree.files[path]) return null;
    await savePhoto(project.id, path, await github.readFileBytes(photos, tree.files[path]));
    return photoUrl(project.id, path);
  } catch {
    return null;
  }
}
