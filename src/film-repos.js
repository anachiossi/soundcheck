// film-repos.js — Projects → Film repos (Ana's devices only): the extra repos her ONE GitHub key
// can read, one private repo per film (film-source.js). They are kept in this device's
// connection: connection.repos = ['anachiossi/film-x', …]; the main repo is always read too.
// Adding one first checks that the key can read it. A device with no extra repos works as before.
// The actions that change the list (screens never change it themselves).
// Used by: parts/film-repos.js

import { getState, saveConnection, showMessage } from './state.js';
import { checkCanRead } from './store/github.js';
import { readRepoName, filmRepos, sameRepo } from './film-source.js';

// Returns true when added (the film list is read again by itself).
export async function addFilmRepo(text) {
  const { connection } = getState();
  const source = readRepoName(text);
  if (!source) {
    showMessage('error', 'Type the repo as owner/name, e.g. anachiossi/my-next-film.');
    return false;
  }
  const name = `${source.owner}/${source.repo}`;
  if (filmRepos(connection).some(repo => sameRepo(repo, source))) { // capitals don't count
    showMessage('ok', `${name} is already in the list.`);
    return false;
  }
  try {
    await checkCanRead({ ...connection, ...source });
  } catch (error) {
    showMessage('error', `This device's key can't read ${name}: ${error.message}. On GitHub, edit the key → Repository access → add ${name}.`);
    return false;
  }
  saveConnection({ ...connection, repos: [...(connection.repos || []), name] });
  showMessage('ok', `Added ${name}. Its films are in the list below.`);
  return true;
}

// The films already on this device stay; they just aren't listed to download any more.
export function removeFilmRepo(name) {
  const { connection } = getState();
  saveConnection({ ...connection, repos: (connection.repos || []).filter(repo => repo !== name) });
}
