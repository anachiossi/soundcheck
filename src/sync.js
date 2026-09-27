// sync.js — keeps the device and the soundcheck-data repo in step.
//   1. download: files that changed in the repo (by their sha fingerprint)
//   2. upload:   scenes saved on this device (the outbox), all in ONE commit
// Runs by itself when the app opens, when signal comes back, when you come
// back to the app, and right after every Save. With no signal nothing happens:
// changes wait safely in the outbox.
// Used by: main.js, editing.js, screens/projects.js, parts/scene-table.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
import { defaultDay, localTodayIso } from './model.js';
import * as github from './store/github.js';
import { applyRemote, filesToDownload, emptyProject, presetFile, formatJson } from './store/repo-files.js';

let lastSync = 0;
const QUIET_GAP = 60 * 1000; // automatic syncs at most once a minute

export function startAutoSync() {
  const quietly = () => Date.now() - lastSync > QUIET_GAP && syncNow();
  addEventListener('online', quietly);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && quietly());
  quietly();
}

export async function syncNow({ loud = false } = {}) {
  const { connection, project, sync } = getState();
  if (!connection || !project || !navigator.onLine || sync.running) return;
  // A film added from a file doesn't know its folder yet: same id, same folder.
  if (!project.folder) await saveAndShow({ ...project, folder: `projects/${project.id}` });
  lastSync = Date.now();
  setState({ sync: { running: true, error: null } });
  try {
    let uploaded = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const tree = await github.readTree(connection);
      await download(connection, tree);
      try {
        uploaded = await upload(connection, tree);
        break;
      } catch (error) {
        if (error.status !== 422 && error.status !== 409) throw error;
        // someone else saved at the same moment: download again, then retry
      }
    }
    setState({ sync: { running: false, error: null, at: new Date().toISOString() } });
    if (loud) showMessage('ok', uploaded ? `Uploaded ${uploaded} scene(s).` : 'Everything is up to date.');
  } catch (error) {
    setState({ sync: { running: false, error: error.message } });
    if (loud) showMessage('error', `Couldn't sync: ${error.message}. Your changes are safe on this device.`);
  }
}

async function download(connection, tree) {
  const project = getState().project;
  const prefix = project.folder + '/';
  const remote = {};
  for (const [path, sha] of Object.entries(tree.files)) {
    if (path.startsWith(prefix) && !path.startsWith(prefix + '_import/')) remote[path.slice(prefix.length)] = sha;
  }
  const changed = {};
  const paths = filesToDownload(project, remote);
  for (let i = 0; i < paths.length; i += 8) { // 8 at a time
    await Promise.all(paths.slice(i, i + 8).map(async path => {
      changed[path] = await github.readJsonFile(connection, remote[path]);
    }));
  }
  const latest = getState().project; // the user may have saved meanwhile
  const merged = applyRemote(latest, changed, remote);
  merged.data_as_of = new Date().toISOString();
  await saveAndShow(merged);
}

async function upload(connection, tree) {
  const project = getState().project;
  const sceneIds = Object.keys(project.outbox || {}).filter(id => !project.conflicts?.[id]);
  if (!sceneIds.length) return 0;

  const files = {};
  for (const id of sceneIds) {
    const change = project.outbox[id];
    const preset = { scene_id: id, updated_at: change.saved_at, updated_by: connection.device, rows: change.rows };
    files[`${project.folder}/${presetFile(id)}`] = formatJson(preset);
  }
  const names = sceneIds.map(id => '#' + id).join(', ');
  await github.commitFiles(connection, tree, files, `Edit ${names} — ${connection.device}`);

  // Uploaded: take these scenes out of the outbox and remember their new fingerprints.
  const after = await github.readTree(connection);
  const latest = getState().project;
  const outbox = { ...latest.outbox };
  const shas = { ...latest.shas };
  for (const id of sceneIds) {
    if (outbox[id]?.saved_at === project.outbox[id].saved_at) delete outbox[id];
    shas[presetFile(id)] = after.files[`${project.folder}/${presetFile(id)}`];
  }
  await saveAndShow({ ...latest, outbox, shas });
  return sceneIds.length;
}

// A scene changed here AND on another device: keep one of the two.
export async function resolveConflict(sceneId, keep) {
  const project = getState().project;
  const conflict = project.conflicts[sceneId];
  const conflicts = { ...project.conflicts };
  delete conflicts[sceneId];
  const outbox = { ...project.outbox };
  const presets = { ...project.presets };
  if (keep === 'theirs') {
    delete outbox[sceneId];
    presets[sceneId] = conflict.theirs;
  } else {
    outbox[sceneId] = { ...outbox[sceneId], saved_at: new Date().toISOString() };
  }
  await saveAndShow({ ...project, conflicts, outbox, presets });
  syncNow();
}

// First time on this device: create the film locally and download everything.
export async function downloadFilm(film) {
  await saveAndShow(emptyProject(film, film.folder), { screen: 'schedule', lookup: [], edit: null });
  await syncNow({ loud: true });
  setState({ day: defaultDay(getState().project, localTodayIso()) });
}

export async function loadFilmList() {
  const { connection } = getState();
  if (!connection || !navigator.onLine) return;
  try {
    const tree = await github.readTree(connection);
    setState({ films: await github.listFilms(connection, tree) });
  } catch (error) {
    showMessage('error', `Couldn't read the films: ${error.message}`);
  }
}
