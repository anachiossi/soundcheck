// sync.js — keeps the device and the soundcheck-data repo in step.
//   1. download: files that changed in the repo (by their sha fingerprint)
//   2. upload:   files changed on this device (the outbox), all in ONE commit
//   3. documents: the PDFs (ODG, sides) of yesterday, today and the coming days,
//      kept on the device for reading offline
// Runs by itself when the app opens, when signal comes back, when you come
// back to the app, and right after every Save. With no signal nothing happens:
// changes wait safely in the outbox.
// Used by: main.js, editing.js, screens/projects.js, parts/scene-table.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
import { saveDocument } from './store/local.js';
import { defaultDay, localTodayIso, shootingDays } from './model.js';
import * as github from './store/github.js';
import { refreshEmailRobot } from './email-robot.js';
import { applyRemote, filesToDownload, emptyProject, fileContent, setFileContent, formatJson } from './store/repo-files.js';

let lastSync = 0;
let runAgain = false; // a save happened while syncing: sync once more right after
const QUIET_GAP = 60 * 1000; // automatic syncs at most once a minute

export function startAutoSync() {
  const quietly = () => Date.now() - lastSync > QUIET_GAP && syncNow();
  addEventListener('online', quietly);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && quietly());
  quietly();
}

export async function syncNow({ loud = false } = {}) {
  const { connection, project, sync } = getState();
  if (!connection || !project || !navigator.onLine) return;
  if (sync.running) { runAgain = true; return; }
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
        await downloadDocuments(connection, tree);
        break;
      } catch (error) {
        if (error.status !== 422 && error.status !== 409) throw error;
        // someone else saved at the same moment: download again, then retry
      }
    }
    setState({ sync: { running: false, error: null, at: new Date().toISOString() } });
    refreshEmailRobot().catch(() => {}); // the ✉ badge (never blocks the sync)
    if (loud) showMessage('ok', uploaded ? `Uploaded ${uploaded} change(s).` : 'Everything is up to date.');
  } catch (error) {
    setState({ sync: { running: false, error: error.message } });
    if (loud) showMessage('error', `Couldn't sync: ${error.message}. Your changes are safe on this device.`);
  }
  if (runAgain) {
    runAgain = false;
    syncNow();
  }
}

async function download(connection, tree) {
  const project = getState().project;
  const prefix = project.folder + '/';
  const remote = {};
  for (const [path, sha] of Object.entries(tree.files)) {
    const inside = path.startsWith(prefix) ? path.slice(prefix.length) : null;
    if (inside && !inside.startsWith('_import/') && !inside.startsWith('docs/')) remote[inside] = sha;
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

// PDFs: 'docs/day-<n>/odg.pdf' and 'sides.pdf' from yesterday on, and 'docs/script.pdf',
// when new or changed.
async function downloadDocuments(connection, tree) {
  const project = getState().project;
  const prefix = project.folder + '/docs/';
  const yesterday = localTodayIso(new Date(Date.now() - 24 * 3600 * 1000));
  const dates = Object.fromEntries(shootingDays(project).map(d => [d.day, d.date]));
  const documents = { ...project.documents };
  let fetched = 0;
  for (const [path, sha] of Object.entries(tree.files)) {
    if (!path.startsWith(prefix) || !path.endsWith('.pdf') || documents[path] === sha) continue;
    const match = /day-(\d+)\/(odg|sides)\.pdf$/.exec(path);
    const isScript = path === prefix + 'script.pdf'; // the full script: always kept (📄 in Kit)
    if (!isScript && (!match || (dates[match[1]] || '') < yesterday)) continue;
    await saveDocument(project.id, path, await github.readFileBytes(connection, sha));
    documents[path] = sha;
    fetched++;
  }
  if (fetched) await saveAndShow({ ...getState().project, documents });
}

async function upload(connection, tree) {
  const project = getState().project;
  const paths = Object.keys(project.outbox || {}).filter(path => !project.conflicts?.[path]);
  if (!paths.length) return 0;

  const files = {};
  for (const path of paths) {
    let content = fileContent(project, path);
    if (path.startsWith('presets/')) content = { ...content, updated_at: project.outbox[path].saved_at, updated_by: connection.device };
    files[`${project.folder}/${path}`] = formatJson(content);
  }
  const names = paths.map(path => path.replace(/^presets\//, '#').replace(/\.json$/, '')).join(', ');
  await github.commitFiles(connection, tree, files, `Edit ${names} — ${connection.device}`);

  // Uploaded: take these files out of the outbox and remember their new fingerprints.
  const after = await github.readTree(connection);
  const latest = getState().project;
  const outbox = { ...latest.outbox };
  const shas = { ...latest.shas };
  for (const path of paths) {
    if (outbox[path]?.saved_at === project.outbox[path].saved_at) delete outbox[path];
    shas[path] = after.files[`${project.folder}/${path}`];
  }
  await saveAndShow({ ...latest, outbox, shas });
  return paths.length;
}

// A file (a scene, or the character/kit list) changed here AND on another
// device: keep one of the two.
export async function resolveConflict(path, keep) {
  const project = { ...getState().project };
  const conflict = project.conflicts[path];
  project.conflicts = { ...project.conflicts };
  delete project.conflicts[path];
  project.outbox = { ...project.outbox };
  if (keep === 'theirs') {
    delete project.outbox[path];
    setFileContent(project, path, conflict.theirs);
  } else {
    project.outbox[path] = { saved_at: new Date().toISOString() };
  }
  await saveAndShow(project);
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
