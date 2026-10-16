// sync-store.js — the film one sync works on, held by its id.
// A sync talks to ONE film's repo, chosen when it starts. If Ana opens another film while it
// runs, this store refuses to go on: the sync stops quietly and nothing is uploaded. Only this
// film's own place on the device is ever saved to; the other film (its outbox, presets and
// fingerprints) is never touched.
// The film she opened then syncs with its own repo next time.
// Part of the sync actions: only sync.js uses it.

import { getState, setState } from './state.js';
import { saveProject, listProjects } from './store/local.js';

// Thrown when another film was opened during the sync. sync.js stops quietly when it sees it.
export class FilmSwitched extends Error {
  constructor() {
    super('Another film was opened during the sync.');
    this.filmSwitched = true;
  }
}

function stillOpen(filmId) {
  if (getState().project?.id !== filmId) throw new FilmSwitched();
}

// read(): the latest copy of the film, only while it is still the open one.
// save(project): saves it in ITS film's place on the device, and shows it only if it is
// still the open film (saving takes a moment: Ana may open another film meanwhile).
export function filmStore(filmId) {
  return {
    read() {
      stillOpen(filmId);
      return getState().project;
    },
    async save(project) {
      stillOpen(filmId);
      if (project.id !== filmId) throw new FilmSwitched();
      await saveProject(project);
      stillOpen(filmId);
      setState({ project, projects: listProjects() });
    },
  };
}
