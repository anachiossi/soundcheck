// costume-photos.js — brings the costume photos from the film's photos repo onto this device (costumes.js says
// which): every thumbnail, and the full photos of the next days. Runs after each sync, in the background: no
// signal, or a key that can't read the photos repo, never stops anything (the cells just show "ch.2" without a
// photo). A full photo not on the device yet is fetched when it is opened (photoNow).
// Used by: sync.js, parts/costume-cell.js

import * as github from './store/github.js';
import { loadPhoto, savePhoto } from './store/local.js';
import { photosConnection, photosToKeep } from './costumes.js';
import { getState } from './state.js';
import { connectionFor } from './film-source.js';

// after a sync: the photos to keep, when new or changed. project.costumePhotos = { files: { path: sha }, noAccess }
export async function downloadCostumePhotos(connection, store) {
  const project = store.read();
  const photos = photosConnection(project, connection);
  if (!photos) return;
  let tree;
  try {
    tree = await github.readTree(photos);
  } catch (error) {
    if (error.status === 403 || error.status === 404) await store.save({ ...store.read(), costumePhotos: { ...project.costumePhotos, noAccess: true } });
    return;
  }
  const files = { ...project.costumePhotos?.files };
  for (const path of photosToKeep(project)) {
    const sha = tree.files[path];
    if (!sha || files[path] === sha) continue;
    await savePhoto(project.id, path, await github.readFileBytes(photos, sha));
    files[path] = sha;
  }
  await store.save({ ...store.read(), costumePhotos: { files, noAccess: false } });
}

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
  const photos = photosConnection(project, connectionFor(project, getState().connection));
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
