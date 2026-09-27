// state.js — the ONE place where the app's data lives.
// Screens read `state` and call actions; they never change data themselves.
// Actions live here (navigation, films on the device), in editing.js (changing
// presets) and in sync.js (GitHub). After every change the screen is redrawn.
// Used by: main.js, editing.js, sync.js and every screen.

import { useEffect, useState } from '../vendor/preact-htm.js';
import * as local from './store/local.js';
import { defaultDay, localTodayIso } from './model.js';
import { upgradeOutbox } from './store/repo-files.js';

let state = {
  project: null,            // the open film (see model.js)
  projects: local.listProjects(),
  screen: 'schedule',       // 'schedule' | 'scenes' | 'kit' | 'projects'
  scheduleMode: 'day',      // 'day' | 'week' | 'all'
  day: null,                // chosen shooting day number
  week: null,               // chosen week number
  lookup: [],               // scene ids chosen in the Scenes screen
  online: navigator.onLine,
  message: null,            // { kind: 'ok' | 'error', text }
  connection: loadJson('sc_github', null), // GitHub: { owner, repo, branch, token, device }
  films: null,              // films in the repo (null = not looked yet)
  sync: { running: false, error: null },
  edit: null,               // scene being edited: { sceneId, rows }
  picker: null,             // open picker: { rowIndex, field }
  busyText: null,           // e.g. 'Making images…'
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(changes) {
  state = { ...state, ...changes };
  savePreferences();
  listeners.forEach(listener => listener(state));
}

// Screens call this to get the current state and redraw when it changes.
export function useAppState() {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state); // catch changes made before we started listening
    return () => listeners.delete(setCurrent);
  }, []);
  return current;
}

// Saves the film on the device and shows it.
export async function saveAndShow(project, extra = {}) {
  await local.saveProject(project);
  setState({ project, projects: local.listProjects(), ...extra });
}

// ---- remembered choices (per device) ------------------------------------------

function savePreferences() {
  const { screen, scheduleMode, day, week, lookup, project, edit } = state;
  try {
    localStorage.setItem('sc_prefs', JSON.stringify({ screen, scheduleMode, day, week, lookup, projectId: project?.id }));
    localStorage.setItem('sc_edit', JSON.stringify(edit && { ...edit, projectId: project?.id }));
  } catch { /* private mode: fine, just not remembered */ }
}

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function saveConnection(connection) {
  try { localStorage.setItem('sc_github', JSON.stringify(connection)); } catch { /* ignore */ }
  setState({ connection, films: null });
}

export function forgetConnection() {
  try { localStorage.removeItem('sc_github'); } catch { /* ignore */ }
  setState({ connection: null, films: null });
}

// ---- actions --------------------------------------------------------------------

export async function start() {
  addEventListener('online', () => setState({ online: true }));
  addEventListener('offline', () => setState({ online: false }));
  local.askForPersistentStorage();

  const prefs = loadJson('sc_prefs', {});
  const projectId = prefs.projectId || state.projects[0]?.id;
  const saved = projectId ? await local.loadProject(projectId) : null;
  if (!saved) return setState({ screen: 'projects' });
  const project = upgradeOutbox(saved);

  const { projectId: _, ...choices } = prefs;
  const draft = loadJson('sc_edit', null);
  const edit = draft?.projectId === project.id ? { sceneId: draft.sceneId, rows: draft.rows } : null;
  setState({ ...choices, project, edit });
  if (state.day === null) setState({ day: defaultDay(project, localTodayIso()) });
}

export const showScreen = screen => setState({ screen, message: null });
export const setScheduleMode = scheduleMode => setState({ scheduleMode });
export const pickDay = day => setState({ day, scheduleMode: 'day' });
export const pickWeek = week => setState({ week, scheduleMode: 'week' });
export const clearMessage = () => setState({ message: null });
export const showMessage = (kind, text) => setState({ message: { kind, text } });

export function addLookup(sceneId) {
  if (!sceneId || state.lookup.includes(sceneId)) return;
  setState({ lookup: [sceneId, ...state.lookup] });
}
export const removeLookup = sceneId => setState({ lookup: state.lookup.filter(id => id !== sceneId) });
export const clearLookup = () => setState({ lookup: [] });

export async function openProject(projectId) {
  const saved = await local.loadProject(projectId);
  if (!saved) return showMessage('error', 'That film is not on this device.');
  const project = upgradeOutbox(saved);
  setState({ project, screen: 'schedule', lookup: [], edit: null, picker: null,
    day: defaultDay(project, localTodayIso()), week: null });
}

// Backup file → device. Unsent changes already on the device are kept.
export async function importProjectFile(file) {
  try {
    const incoming = await local.readProjectFile(file);
    const existing = await local.loadProject(incoming.id);
    const kept = existing && upgradeOutbox(existing);
    const project = upgradeOutbox({ outbox: {}, conflicts: {}, shas: {}, ...incoming,
      ...(kept && { outbox: kept.outbox, conflicts: kept.conflicts }) });
    await local.saveProject(project);
    await openProject(project.id);
    showMessage('ok', `${project.name} is now saved on this device.`);
  } catch (error) {
    showMessage('error', error.message);
  }
}

export function downloadProjectFile() {
  const project = state.project;
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: local.projectFileName(project),
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
