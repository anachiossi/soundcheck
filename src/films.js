// films.js — the films in the data repos: the list shown in Projects, and getting a
// film onto this device for the first time (then sync.js keeps it up to date).
// Ana's devices read the main repo and every extra "Film repo" (film-source.js); each film
// remembers the repo it came from (project.source). Two films with the same id in different
// repos: only one can be on the device, the other is refused with a message.
// A crew phone (crew-link.js) sees only the film its link was made for (joining: crew-join.js).
// Used by: screens/projects.js, crew-join.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
import { isCrew, CREW_ACCESS_ENDED } from './crew-link.js';
import { defaultDay } from './model.js';
import * as github from './store/github.js';
import { emptyProject } from './store/repo-files.js';
import { syncNow } from './sync.js';
import { filmRepos, markClashes, onDevice, clashMessage } from './film-source.js';

// First time on this device: create the film locally and download everything.
// film = { id, name, folder, owner, repo, branch } (github.js listFilms / readFilm)
export async function downloadFilm(film) {
  if (film.clash || onDevice(film, getState().projects, getState().connection) === 'other') {
    return showMessage('error', clashMessage(film));
  }
  const project = emptyProject(film, film.folder);
  if (film.owner && film.repo) project.source = { owner: film.owner, repo: film.repo, branch: film.branch || 'main' };
  await saveAndShow(project, { screen: 'schedule', lookup: [], edit: null });
  await syncNow({ loud: true });
  setState({ day: defaultDay(getState().project) });
}

export async function loadFilmList() {
  const { connection } = getState();
  if (!connection || !navigator.onLine) return;
  try {
    // a crew phone sees only the film its link was made for
    if (isCrew(connection) && connection.folder) return setState({ films: [await github.readFilm(connection, connection.folder)] });
    setState({ films: await readAllFilms(connection, getState().projects) });
  } catch (error) {
    // a crew phone: no message (crew-join.js retries the download), unless its access has ended
    if (isCrew(connection)) return error.status === 401 && showMessage('error', CREW_ACCESS_ENDED);
    showMessage('error', `Couldn't read the films: ${error.message}`);
  }
}

// Films from every repo, sorted by name. The main repo must answer; an extra repo that doesn't
// is skipped with a message (its films come back at the next look). (exported for tests)
export async function readAllFilms(connection, projectsOnDevice) {
  const films = [];
  const failed = [];
  for (const [index, source] of filmRepos(connection).entries()) {
    const repoConnection = { ...connection, ...source };
    try {
      films.push(...await github.listFilms(repoConnection, await github.readTree(repoConnection)));
    } catch (error) {
      if (index === 0) throw error;
      failed.push(`${source.owner}/${source.repo} (${error.message})`);
    }
  }
  if (failed.length) showMessage('error', `Couldn't read the films of ${failed.join(', ')}.`);
  // clashes first, while the films are still in repo order (the main repo's film wins)
  return markClashes(films, projectsOnDevice, connection).sort((a, b) => a.name.localeCompare(b.name));
}
