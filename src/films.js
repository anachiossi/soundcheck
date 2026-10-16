// films.js — the films in the soundcheck-data repo: the list shown in Projects, and getting a
// film onto this device for the first time (then sync.js keeps it up to date).
// A crew phone (crew-link.js) sees only the film its link was made for.
// Used by: screens/projects.js, main.js (opening a crew link)

import { getState, setState, saveAndShow, showMessage, openProject } from './state.js';
import { isCrew, CREW_ACCESS_ENDED } from './crew-link.js';
import { defaultDay } from './model.js';
import * as github from './store/github.js';
import { emptyProject } from './store/repo-files.js';
import { syncNow } from './sync.js';

// First time on this device: create the film locally and download everything.
export async function downloadFilm(film) {
  await saveAndShow(emptyProject(film, film.folder), { screen: 'schedule', lookup: [], edit: null });
  await syncNow({ loud: true });
  setState({ day: defaultDay(getState().project) });
}

// A crew phone just opened its link (main.js): find the film in its folder, then open it
// (already on the phone: its unsent changes are kept) or download it.
export async function downloadCrewFilm(folder) {
  try {
    const film = await github.readFilm(getState().connection, folder);
    if (getState().projects.some(project => project.id === film.id)) {
      await openProject(film.id);
      await syncNow({ loud: true });
    } else {
      await downloadFilm(film);
    }
  } catch (error) {
    showMessage('error', error.status === 401 ? CREW_ACCESS_ENDED : `Couldn't download the film: ${error.message}.`);
  }
}

export async function loadFilmList() {
  const { connection } = getState();
  if (!connection || !navigator.onLine) return;
  try {
    // a crew phone sees only the film its link was made for
    if (isCrew(connection) && connection.folder) return setState({ films: [await github.readFilm(connection, connection.folder)] });
    const tree = await github.readTree(connection);
    setState({ films: await github.listFilms(connection, tree) });
  } catch (error) {
    showMessage('error', `Couldn't read the films: ${error.message}`);
  }
}
