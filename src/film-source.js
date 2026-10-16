// film-source.js — which GitHub repo each film lives in (one private repo per film).
// Ana's device has ONE key that can read several repos: the main one of the connection
// (owner/repo, e.g. soundcheck-data) and the extra "Film repos" she added in Projects
// (connection.repos = ['anachiossi/film-x', …], film-repos.js).
// Each film on the device remembers where it came from: project.source = { owner, repo, branch }
// (set when it is downloaded; a crew phone's film: from its link). A film downloaded before
// this existed has no source: it lives in the main repo, exactly as before.
// connectionFor() gives the connection to use for a film: its repo + this device's key, name and role.
// Every place that talks to GitHub about a film uses it.
// Plain data in, plain data out (no network, no screens).
// Used by: sync.js, films.js, film-repos.js, email-robot.js, crew-approve.js, crew-inbox-sync.js,
// parts/crew-share.js, parts/email-robot.js, parts/film-repos.js

// The connection for one film: same key, device, role and name; the film's own repo.
export function connectionFor(project, connection) {
  if (!connection) return null;
  const source = project?.source;
  if (!source?.owner || !source?.repo) return connection;
  return { ...connection, owner: source.owner, repo: source.repo, branch: source.branch || 'main' };
}

// Where a film lives: { owner, repo, branch }. No source = the main repo of the connection.
export function sourceOf(project, connection) {
  const used = connectionFor(project, connection) || {};
  return { owner: used.owner, repo: used.repo, branch: used.branch };
}

// GitHub ignores capitals in owner/repo: 'AnaChiossi/Film-X' is the same repo as 'anachiossi/film-x'.
export function sameRepo(first, second) {
  const name = source => `${source.owner}/${source.repo}`.toLowerCase();
  return name(first) === name(second);
}

export function sameSource(first, second) {
  return sameRepo(first, second) && (first.branch || 'main') === (second.branch || 'main');
}

// 'anachiossi/film-x' → { owner, repo, branch: 'main' }, or null when it isn't owner/name.
export function readRepoName(text) {
  const match = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(String(text || '').trim());
  return match ? { owner: match[1], repo: match[2], branch: 'main' } : null;
}

// Every repo the films are read from: the main one first, then the extra ones.
// (the extra repos are read on their 'main' branch)
export function filmRepos(connection) {
  if (!connection) return [];
  const main = { owner: connection.owner, repo: connection.repo, branch: connection.branch };
  const repos = [main];
  for (const source of (connection.repos || []).map(readRepoName).filter(Boolean)) {
    if (!repos.some(repo => sameRepo(repo, source))) repos.push(source); // each repo once
  }
  return repos;
}

// Two films with the same id in different repos (rare): both are shown with their repo name
// (showRepo), and only one can be on the device: the one already here, or else the one found
// first. The other gets clash: true and can't be downloaded.
// films = [{ id, name, folder, owner, repo, branch }]; deviceFilms = [{ id, source }] (local.js list)
export function markClashes(films, deviceFilms, connection) {
  const kept = {};
  for (const film of films) {
    const here = deviceFilms.find(project => project.id === film.id);
    const wanted = here ? sameSource(sourceOf(here, connection), film) : !kept[film.id];
    if (wanted && !kept[film.id]) kept[film.id] = film;
  }
  return films.map(film => {
    const twins = films.filter(other => other.id === film.id).length > 1;
    if (!twins) return film;
    return { ...film, showRepo: true, clash: kept[film.id] !== film };
  });
}

// Is this film from the repo list already on the device? 'here' (open it), 'other' (a film with
// the same id from another repo is here: can't download it) or '' (download it).
export function onDevice(film, projects, connection) {
  const here = projects.find(project => project.id === film.id);
  if (!here) return '';
  return sameSource(sourceOf(here, connection), film) ? 'here' : 'other';
}

export const clashMessage = film =>
  `A film with the same id (${film.id}) from another repo is already used on this device: ${film.name} from ${film.owner}/${film.repo} can't be downloaded. Give one of them another id.`;
