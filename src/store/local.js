// local.js — keeps projects on this device, so the app works with no signal.
// Each film gets its OWN database ("soundcheck:<project-id>"), so starting a
// new film never touches the data of an old one.
// Also: import/export a project as a .json file (backup, AirDrop, Files app),
// and the PDFs of each day (ODG, sides) for reading offline.
// Used by: state.js

import { PROJECT_FORMAT } from '../model.js';

const PREFIX = 'soundcheck:';
const STORE = 'project';

const DOCS = 'docs'; // PDFs (ODG, sides) by their repo path, e.g. 'docs/day-6/odg.pdf'

function openDb(projectId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PREFIX + projectId, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS); // added in version 2
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run(db, mode, action, store = STORE) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveProject(project) {
  const db = await openDb(project.id);
  await run(db, 'readwrite', store => store.put(project, 'data'));
  db.close();
  rememberProject(project);
}

export async function loadProject(projectId) {
  const db = await openDb(projectId);
  const project = await run(db, 'readonly', store => store.get('data'));
  db.close();
  return project || null;
}

// Documents (PDF files) kept on the device for offline reading.
export async function saveDocument(projectId, path, bytes) {
  const db = await openDb(projectId);
  await run(db, 'readwrite', store => store.put(bytes, path), DOCS); // raw bytes: safest on iPhone
  db.close();
}

export async function loadDocument(projectId, path) {
  const db = await openDb(projectId);
  const bytes = await run(db, 'readonly', store => store.get(path), DOCS);
  db.close();
  return bytes ? new Blob([bytes], { type: 'application/pdf' }) : null;
}

// The list of films on this device is kept in a small index so it can be
// shown before any database is opened.
export function listProjects() {
  try { return JSON.parse(localStorage.getItem('sc_projects') || '[]'); } catch { return []; }
}

function rememberProject(project) {
  const others = listProjects().filter(p => p.id !== project.id);
  const entry = { id: project.id, name: project.name, data_as_of: project.data_as_of };
  try { localStorage.setItem('sc_projects', JSON.stringify([entry, ...others])); } catch { /* storage full or blocked */ }
}

// Ask the browser not to clear our data when space runs low (iPhone/iPad).
export async function askForPersistentStorage() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}

// ---- project files ----------------------------------------------------------

export function checkProjectFile(data) {
  if (!data || data.format !== PROJECT_FORMAT) throw new Error('This is not a soundcheck project file.');
  for (const key of ['id', 'name', 'characters', 'transmitters', 'lavaliers', 'schedule', 'presets']) {
    if (!(key in data)) throw new Error(`Project file is missing "${key}".`);
  }
  return data;
}

export async function readProjectFile(file) {
  return checkProjectFile(JSON.parse(await file.text()));
}

export function projectFileName(project) {
  return `${project.id}.soundcheck.json`;
}
