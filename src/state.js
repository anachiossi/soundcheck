// state.js — the ONE place where the app's data lives and changes.
// Screens read `state` and call the actions below; they never change data
// themselves. After every change, the screen is redrawn from the new state.
// Used by: main.js and every screen.

import { useEffect, useState } from '../vendor/preact-htm.js';
import * as local from './store/local.js';
import { fetchFromSheets } from './store/sheets.js';
import { defaultDay, localTodayIso } from './model.js';

let state = {
  project: null,            // the open film (see model.js)
  projects: local.listProjects(),
  screen: 'schedule',       // 'schedule' | 'scenes' | 'kit' | 'projects'
  scheduleMode: 'day',      // 'day' | 'week' | 'all'
  day: null,                // chosen shooting day number
  week: null,               // chosen week number
  lookup: [],               // scene ids chosen in the Scenes screen
  online: navigator.onLine,
  busy: false,              // true while downloading
  message: null,            // { kind: 'ok' | 'error', text }
};

const listeners = new Set();

export function getState() {
  return state;
}

function setState(changes) {
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

// ---- remembered choices (per device) ------------------------------------------

const PREFS_KEY = 'sc_prefs';

function savePreferences() {
  const { screen, scheduleMode, day, week, lookup, project } = state;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ screen, scheduleMode, day, week, lookup, projectId: project?.id }));
  } catch { /* private mode: fine, just not remembered */ }
}

function loadPreferences() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}

// ---- actions --------------------------------------------------------------------

export async function start() {
  addEventListener('online', () => setState({ online: true }));
  addEventListener('offline', () => setState({ online: false }));
  local.askForPersistentStorage();

  const prefs = loadPreferences();
  const projectId = prefs.projectId || state.projects[0]?.id;
  const project = projectId ? await local.loadProject(projectId) : null;
  if (!project) return setState({ screen: 'projects' });

  const { projectId: _, ...choices } = prefs;
  setState({ ...choices, project });
  if (state.day === null) setState({ day: defaultDay(project, localTodayIso()) });
}

export const showScreen = screen => setState({ screen, message: null });
export const setScheduleMode = scheduleMode => setState({ scheduleMode });
export const pickDay = day => setState({ day, scheduleMode: 'day' });
export const pickWeek = week => setState({ week, scheduleMode: 'week' });
export const clearMessage = () => setState({ message: null });

export function addLookup(sceneId) {
  if (!sceneId || state.lookup.includes(sceneId)) return;
  setState({ lookup: [sceneId, ...state.lookup] });
}
export const removeLookup = sceneId => setState({ lookup: state.lookup.filter(id => id !== sceneId) });
export const clearLookup = () => setState({ lookup: [] });

export async function openProject(projectId) {
  const project = await local.loadProject(projectId);
  if (!project) return setState({ message: { kind: 'error', text: 'That project is not on this device.' } });
  setState({ project, screen: 'schedule', lookup: [], day: defaultDay(project, localTodayIso()), week: null });
}

export async function importProjectFile(file) {
  try {
    const project = await local.readProjectFile(file);
    await local.saveProject(project);
    setState({ projects: local.listProjects() });
    await openProject(project.id);
    setState({ message: { kind: 'ok', text: `${project.name} is now saved on this device.` } });
  } catch (error) {
    setState({ message: { kind: 'error', text: error.message } });
  }
}

// Download fresh data from the Sheets. If anything fails, the offline copy stays.
export async function refreshFromSheets() {
  const project = state.project;
  if (!project?.sources) return;
  setState({ busy: true, message: null });
  try {
    const fresh = await fetchFromSheets(project.sources);
    const updated = { ...project, ...fresh, schedule: fresh.schedule || project.schedule, data_as_of: new Date().toISOString() };
    await local.saveProject(updated);
    setState({ project: updated, projects: local.listProjects(), busy: false,
      message: { kind: 'ok', text: 'Updated from Sheets.' } });
  } catch (error) {
    setState({ busy: false, message: { kind: 'error',
      text: `Couldn't update (${error.message}). You're still seeing the saved copy.` } });
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
