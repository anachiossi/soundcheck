// kit-files.js — where a film's files are in the repo, now that a fonico's kit lives on its own (Ana, 29 Oct).
// A film may name its kit in settings.json → "kit": "angelo-davide". The kit's files (KIT_FILES, and the manuals'
// PDFs under docs/manuals/) then live ONCE in kits/<kit>/, with the same names, shared by every film made with that
// kit, and only ever growing (kit-requests.js). The film keeps what is its own: the ticks, what is on this film
// (gear/on-film.json), the IFB crew and list, everything else.
// The app keeps calling every file by its film name ('gear/items.json'); only these two functions know where it is.
// No "kit" setting = everything in the film's folder, as before.
// No network here: plain data in, plain data out. Used by: sync.js, manuals.js, crew-inbox.js

export const KIT_FILES = ['gear/categories.json', 'gear/items.json', 'gear/history.json', 'gear/manuals.json', 'gear/batteries.json',
  'gear/photos.json', 'transmitters.json', 'lavaliers.json', 'ifb/receivers.json', 'ifb/headphones.json'];

export const kitOf = project => String(project?.settings?.kit || '').trim();
const isKitFile = path => KIT_FILES.includes(path) || path.startsWith('docs/manuals/');

// where one of the film's files is in the repo: 'gear/items.json' → 'kits/angelo-davide/gear/items.json'
export function repoPath(project, path) {
  const kit = kitOf(project);
  return kit && isKitFile(path) ? `kits/${kit}/${path}` : `${project.folder}/${path}`;
}

// The repo's files under the film's names: { 'gear/items.json': sha, 'schedule.json': sha, … }.
// With a kit, its files come from kits/<kit>/, and old copies left in the film's folder are ignored.
export function filmPaths(project, repoFiles) {
  const kit = kitOf(project);
  const found = {};
  for (const [path, sha] of Object.entries(repoFiles)) {
    if (path.startsWith(`${project.folder}/`)) {
      const inside = path.slice(project.folder.length + 1);
      if (!(kit && isKitFile(inside))) found[inside] = sha;
    } else if (kit && path.startsWith(`kits/${kit}/`)) {
      const inside = path.slice(`kits/${kit}/`.length);
      if (isKitFile(inside)) found[inside] = sha;
    }
  }
  return found;
}
