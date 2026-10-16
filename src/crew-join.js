// crew-join.js — opening a crew link on a phone (crew-link.js): connect this phone as that
// person, then download the film.
// With no signal (or when the download fails) the phone remembers it still has to download the
// film ('sc_crew_join' on the device) and tries again by itself: when signal comes back, when the
// app comes back to the front, and at the next start.
// A key that no longer works (401) says "crew access has ended" and stops trying.
// Used by: main.js

import { getState, setState, showMessage, joinAsCrew, openProject } from './state.js';
import { readCrewLink, isCrew, CREW_ACCESS_ENDED } from './crew-link.js';
import { downloadFilm } from './films.js';
import * as github from './store/github.js';
import { syncNow } from './sync.js';

export const NO_SIGNAL_JOIN = "No signal: the film will download as soon as you're online.";
const KEY = 'sc_crew_join'; // the film folder still to download
let downloading = false;

// A crew link in the address bar (main.js). The address bar is cleared first: the key must not stay there.
export async function joinFromLink() {
  const link = readCrewLink(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (!link) return showMessage('error', 'This link is not complete: ask for it again.');
  if (!joinAsCrew(link)) return showMessage('error', 'This device is connected as the owner. To open a crew link here, Disconnect first (Projects).');
  setState({ screen: 'projects' });
  if (navigator.onLine) showMessage('ok', `Welcome, ${link.name}. Downloading the film…`);
  await downloadCrewFilm(link.folder);
}

// Find the film in its folder, then open it (already on the phone: its unsent changes are kept)
// or download it.
export async function downloadCrewFilm(folder) {
  if (downloading) return;
  rememberPendingJoin(folder);
  if (!navigator.onLine) return showMessage('error', NO_SIGNAL_JOIN);
  downloading = true;
  try {
    const film = await github.readFilm(getState().connection, folder);
    if (getState().projects.some(project => project.id === film.id)) {
      await openProject(film.id);
      await syncNow({ loud: true });
    } else {
      await downloadFilm(film);
    }
    forgetPendingJoin();
  } catch (error) {
    if (error.status === 401) forgetPendingJoin();
    showMessage('error', error.status === 401 ? CREW_ACCESS_ENDED : NO_SIGNAL_JOIN);
  } finally {
    downloading = false;
  }
}

// Tries the remembered download again (only on a crew phone, with signal).
export function retryPendingJoin() {
  const folder = pendingJoin();
  const { connection } = getState();
  if (!folder || !isCrew(connection) || !navigator.onLine) return;
  if (connection.folder !== folder) return forgetPendingJoin(); // a newer link replaced it
  downloadCrewFilm(folder);
}

// At start (main.js): try now, and again when signal comes back or the app comes back to the front.
export function watchPendingJoin() {
  addEventListener('online', retryPendingJoin);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && retryPendingJoin());
  retryPendingJoin();
}

export function pendingJoin() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

function rememberPendingJoin(folder) {
  try { localStorage.setItem(KEY, folder); } catch { /* not remembered after a reload */ }
}

function forgetPendingJoin() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
