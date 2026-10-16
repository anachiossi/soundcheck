// films.js — the films in the soundcheck-data repo: the list shown in Projects, and getting a
// film onto this device for the first time (then sync.js keeps it up to date).
// A crew phone (crew-link.js) sees only the film its link was made for (joining: crew-join.js).
// Used by: screens/projects.js, crew-join.js

import { getState, setState, saveAndShow, showMessage } from './state.js';
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

export async function loadFilmList() {
  const { connection } = getState();
  if (!connection || !navigator.onLine) return;
  try {
    // a crew phone sees only the film its link was made for
    if (isCrew(connection) && connection.folder) return setState({ films: [await github.readFilm(connection, connection.folder)] });
    const tree = await github.readTree(connection);
    setState({ films: await github.listFilms(connection, tree) });
  } catch (error) {
    // a crew phone: no message (crew-join.js retries the download), unless its access has ended
    if (isCrew(connection)) return error.status === 401 && showMessage('error', CREW_ACCESS_ENDED);
    showMessage('error', `Couldn't read the films: ${error.message}`);
  }
}
