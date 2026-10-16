// sync.js — keeps the device and the soundcheck-data repo in step.
//   1. download: files that changed in the repo (by their sha fingerprint)
//   2. upload:   files changed on this device (the outbox), all in ONE commit
//   3. documents: the PDFs (ODG, sides) of every day and the script, kept on the device
//      for reading offline
// Runs by itself when the app opens, when signal comes back, when you come
// back to the app, and right after every Save. With no signal nothing happens:
// changes wait safely in the outbox.
// A crew phone (crew-link.js) never commits: its changes stay on the phone, "proposed", and
// are sent as suggestions (crew-sync.js).
// Used by: main.js, editing.js, films.js, screens/projects.js, parts/scene-table.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
import { isCrew, CREW_ACCESS_ENDED } from './crew-link.js';
import { saveDocument } from './store/local.js';
import { localTodayIso, shootingDays } from './model.js';
import * as github from './store/github.js';
import * as crew from './crew-sync.js';
import { refreshEmailRobot } from './email-robot.js';
import { applyRemote, filesToDownload, fileContent, setFileContent, formatJson } from './store/repo-files.js';

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
    if (isCrew(connection)) {
      const sent = await syncAsCrew(connection);
      setState({ sync: { running: false, error: null, at: new Date().toISOString() } });
      if (loud) showMessage('ok', sent ? `Sent ${sent} suggestion(s).` : 'Everything is up to date.');
    } else {
      const uploaded = await syncAsOwner(connection);
      setState({ sync: { running: false, error: null, at: new Date().toISOString() } });
      refreshEmailRobot().catch(() => {}); // the ✉ badge (never blocks the sync)
      if (loud) showMessage('ok', uploaded ? `Uploaded ${uploaded} change(s).` : 'Everything is up to date.');
    }
  } catch (error) {
    const accessEnded = error.status === 401 && isCrew(connection); // the crew key expired
    setState({ sync: { running: false, error: accessEnded ? CREW_ACCESS_ENDED : error.message } });
    if (loud && accessEnded) showMessage('error', CREW_ACCESS_ENDED);
    else if (loud) showMessage('error', `Couldn't sync: ${error.message}. Your changes are safe on this device.`);
  }
  if (runAgain) {
    runAgain = false;
    syncNow();
  }
}

// Ana's devices: download, then upload the outbox as one commit.
async function syncAsOwner(connection) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const tree = await github.readTree(connection);
    await download(connection, tree);
    try {
      const uploaded = await upload(connection, tree);
      await downloadDocuments(connection, tree);
      return uploaded;
    } catch (error) {
      if (error.status !== 422 && error.status !== 409) throw error;
      // someone else saved at the same moment: download again, then retry
    }
  }
  return 0;
}

// A crew phone (crew-sync.js): closed suggestions first (so their files are downloaded again
// now), then download, then send the outbox as suggestions. Never commits.
async function syncAsCrew(connection) {
  const store = { read: () => getState().project, save: project => saveAndShow(project) };
  await crew.takeBackClosed(connection, store);
  const tree = await github.readTree(connection);
  await download(connection, tree);
  const sent = await crew.sendSuggestions(connection, store);
  await downloadDocuments(connection, tree);
  return sent;
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
  let merged;
  if (isCrew(connection)) merged = crew.keepProposed(applyRemote(crew.noteBases(latest), changed, remote));
  else merged = applyRemote(latest, changed, remote);
  merged.data_as_of = new Date().toISOString();
  await saveAndShow(merged);
}

// PDFs: every 'docs/day-<n>/odg.pdf' and 'sides.pdf', and 'docs/script.pdf', when new or
// changed (a film's worth is ~25 MB). Yesterday on first: on weak signal those matter most.
async function downloadDocuments(connection, tree) {
  const project = getState().project;
  const prefix = project.folder + '/docs/';
  const yesterday = localTodayIso(new Date(Date.now() - 24 * 3600 * 1000));
  const dates = Object.fromEntries(shootingDays(project).map(d => [d.day, d.date]));
  const documents = { ...project.documents };
  const dateOf = path => dates[/day-(\d+)\//.exec(path)?.[1]] || '';
  // docs/archive/ (every official email, outdated too — pipeline/run.py file_archive) stays in the repo only
  const wanted = Object.entries(tree.files)
    .filter(([path, sha]) => path.startsWith(prefix) && !path.startsWith(`${prefix}archive/`) && path.endsWith('.pdf') && documents[path] !== sha)
    .sort(([a], [b]) => (dateOf(a) < yesterday) - (dateOf(b) < yesterday));
  let fetched = 0;
  for (const [path, sha] of wanted) {
    await saveDocument(project.id, path, await github.readFileBytes(connection, sha));
    documents[path] = sha;
    fetched++;
  }
  if (fetched) await saveAndShow({ ...getState().project, documents });
}

async function upload(connection, tree) {
  if (isCrew(connection)) return 0; // crew never commit: the outbox stays on the phone
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
