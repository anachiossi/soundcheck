// film-close.js — "Close film on this device" (Ana, 2 Nov 2026): when a film is over, its copy on this
// device (the data, the day PDFs, the photos) is deleted to free space for the next film.
// NEVER the data repo: nothing here talks to GitHub, and the film can be downloaded again from Projects.
// A film with changes only on this device (not uploaded yet, or made on two devices) is never closed.
// Used by: screens/projects.js

import { getState, setState, showMessage } from './state.js';
import * as local from './store/local.js';

// What stops a film from closing; '' = nothing. (exported for tests)
export function whyNotClose(project, { syncing = false } = {}) {
  const waiting = Object.keys(project.outbox || {}).length;
  const conflicts = Object.keys(project.conflicts || {}).length;
  if (syncing) return `${project.name} is syncing: wait until it's done, then close it.`;
  if (conflicts) return `${project.name} has changes made on two devices: choose them first, then close it.`;
  if (waiting) return `${project.name} has ${waiting} change(s) only on this device: sync first, then close it.`;
  return '';
}

export async function closeFilm(projectId) {
  const { project: open, sync } = getState();
  const isOpen = open?.id === projectId;
  const project = isOpen ? open : await local.loadProject(projectId);
  if (!project) return showMessage('error', 'That film is not on this device.');
  const problem = whyNotClose(project, { syncing: isOpen && sync.running });
  if (problem) return showMessage('error', problem);

  await local.deleteProject(projectId);
  setState({ projects: local.listProjects(),
    ...(isOpen && { project: null, screen: 'projects', edit: null, picker: null, lookup: [], day: null, week: null }) });
  showMessage('ok', `${project.name} is closed on this device. It is safe in your data: download it again here whenever you want.`);
}
