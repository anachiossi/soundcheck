// sync.js — keeps the device and the film's data repo (project.source, film-source.js) in step.
//   1. download: files that changed in the repo (by their sha fingerprint)
//   2. upload:   files changed on this device (the outbox), all in ONE commit
//   3. documents: the PDFs (ODG, sides) of every day and the script, kept on the device
//      for reading offline
// Runs by itself when the app opens, when signal comes back, when you come
// back to the app, and right after every Save. With no signal nothing happens:
// changes wait safely in the outbox.
// A crew phone (crew-link.js) never commits: its changes stay on the phone, "proposed", and
// are sent as suggestions (crew-sync.js). Ana's devices then list those (crew-inbox-sync.js).
// It never downloads the film's hours/ and push/ (Ana's): its hours are its own.
// Used by: main.js, editing.js, films.js, screens/projects.js, parts/scene-table.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
import { isCrew, CREW_ACCESS_ENDED } from './crew-link.js';
import { saveDocument } from './store/local.js';
import { localTodayIso, shootingDays } from './model.js';
import * as github from './store/github.js';
import * as crew from './crew-sync.js';
import * as inbox from './crew-inbox.js';
import { ownerInbox } from './crew-inbox-sync.js';
import { sendWaitingFeedback } from './crew-feedback.js';
import { refreshEmailRobot } from './email-robot.js';
import { connectionFor } from './film-source.js';
import { filmStore } from './sync-store.js';
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
  const { connection: deviceConnection, project, sync } = getState();
  if (!deviceConnection || !project || !navigator.onLine) return;
  const connection = connectionFor(project, deviceConnection); // the film's own repo (film-source.js)
  if (sync.running) { runAgain = true; return; }
  // A film added from a file doesn't know its folder yet: same id, same folder.
  if (!project.folder) await saveAndShow({ ...project, folder: `projects/${project.id}` });
  lastSync = Date.now();
  setState({ sync: { running: true, error: null } });
  const deviceStore = filmStore(project.id); // only this film: another one opened meanwhile stops the sync
  try {
    if (isCrew(connection)) {
      const sent = await syncAsCrew(connection, deviceStore);
      setState({ sync: { running: false, error: null, at: new Date().toISOString() } });
      if (loud) showMessage('ok', sent ? `Sent ${sent} suggestion(s).` : 'Everything is up to date.');
    } else {
      const uploaded = await syncAsOwner(connection, deviceStore);
      setState({ sync: { running: false, error: null, at: new Date().toISOString() } });
      refreshEmailRobot().catch(() => {}); // the ✉ badge (never blocks the sync)
      if (loud) showMessage('ok', uploaded ? `Uploaded ${uploaded} change(s).` : 'Everything is up to date.');
    }
  } catch (error) {
    const accessEnded = error.status === 401 && isCrew(connection); // the crew key expired
    const switched = error.filmSwitched; // another film was opened (sync-store.js): stop quietly
    setState({ sync: { running: false, error: switched ? null : accessEnded ? CREW_ACCESS_ENDED : error.message } });
    if (loud && accessEnded) showMessage('error', CREW_ACCESS_ENDED);
    else if (loud && !switched) showMessage('error', `Couldn't sync: ${error.message}. Your changes are safe on this device.`);
  }
  if (runAgain) {
    runAgain = false;
    syncNow();
  }
}

// Ana's devices: download, then upload the outbox as one commit, then the crew's suggestions.
// (exported for tests/crew-approve.test.js)
export async function syncAsOwner(connection, store) {
  const uploaded = await downloadAndUpload(connection, store);
  await ownerInbox(connection, store); // the crew's suggestions and feedback (crew-inbox-sync.js)
  return uploaded;
}

async function downloadAndUpload(connection, store) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const tree = await github.readTree(connection);
    await download(connection, tree, store);
    try {
      const uploaded = await upload(connection, tree, store);
      await downloadDocuments(connection, tree, store);
      return uploaded;
    } catch (error) {
      if (error.status !== 422 && error.status !== 409) throw error;
      // someone else saved at the same moment: download again, then retry
    }
  }
  return 0;
}

// A crew phone (crew-sync.js): closed suggestions first (so their files are downloaded again
// now), then download, then send the outbox as suggestions and any feedback. Never commits. (tests too)
export async function syncAsCrew(connection, store) {
  await crew.takeBackClosed(connection, store);
  const tree = await github.readTree(connection);
  await download(connection, tree, store);
  const sent = await crew.sendSuggestions(connection, store);
  await sendWaitingFeedback(connection, store); // never throws (crew-feedback.js)
  await downloadDocuments(connection, tree, store);
  return sent;
}

async function download(connection, tree, store) {
  const project = store.read();
  const prefix = project.folder + '/';
  const crewPhone = isCrew(connection);
  const remote = {};
  for (const [path, sha] of Object.entries(tree.files)) {
    const inside = path.startsWith(prefix) ? path.slice(prefix.length) : null;
    const personal = crewPhone && inside && crew.staysOnPhone(inside); // Ana's hours/ and push/
    if (inside && !inside.startsWith('_import/') && !inside.startsWith('docs/') && !personal) remote[inside] = sha;
  }
  const changed = {};
  const paths = filesToDownload(project, remote);
  for (let i = 0; i < paths.length; i += 8) { // 8 at a time
    await Promise.all(paths.slice(i, i + 8).map(async path => {
      changed[path] = await github.readJsonFile(connection, remote[path]);
    }));
  }
  const latest = store.read(); // the user may have saved meanwhile
  const merged = crewPhone ? crew.mergeDownload(latest, changed, remote) : applyRemote(latest, changed, remote);
  merged.data_as_of = new Date().toISOString();
  await store.save(merged);
}

// PDFs: every 'docs/day-<n>/odg.pdf' and 'sides.pdf', and 'docs/script.pdf', when new or
// changed (a film's worth is ~25 MB). Yesterday on first: on weak signal those matter most.
async function downloadDocuments(connection, tree, store) {
  const project = store.read();
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
  if (fetched) await store.save({ ...store.read(), documents });
}

async function upload(connection, tree, store) {
  if (isCrew(connection)) return 0; // crew never commit: the outbox stays on the phone
  const project = store.read();
  const paths = Object.keys(project.outbox || {}).filter(path => !project.conflicts?.[path]);
  if (!paths.length) return 0;

  const files = {};
  for (const path of paths) {
    let content = fileContent(project, path);
    if (path.startsWith('presets/')) content = { ...content, updated_at: project.outbox[path].saved_at, updated_by: connection.device };
    files[`${project.folder}/${path}`] = formatJson(content);
  }
  const names = paths.map(path => path.replace(/^presets\//, '#').replace(/\.json$/, '')).join(', ');
  // a file holding an approved crew suggestion: "… — proposed by Davide, approved" (crew-inbox.js)
  const approved = inbox.approvalNote(paths, getState().crewDecisions, project.folder);
  await github.commitFiles(connection, tree, files, `Edit ${names} — ${connection.device}${approved}`);

  // Uploaded: take these files out of the outbox and remember their new fingerprints.
  const after = await github.readTree(connection);
  const latest = store.read();
  const outbox = { ...latest.outbox };
  const shas = { ...latest.shas };
  for (const path of paths) {
    if (outbox[path]?.saved_at === project.outbox[path].saved_at) delete outbox[path];
    shas[path] = after.files[`${project.folder}/${path}`];
  }
  await store.save({ ...latest, outbox, shas });
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
