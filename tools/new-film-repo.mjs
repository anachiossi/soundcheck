// new-film-repo.mjs — prepares, on this computer, the folder that becomes the next film's own
// private data repo (one repo per film, docs/CREW_SHARING.md → "Setting up the next film").
//
//   node tools/new-film-repo.mjs <target-folder> <film-id> "<Film name>" <TAG> [--from <soundcheck-data clone>]
//   e.g. node tools/new-film-repo.mjs ../film-x-data film-x "Film X" FX
//
// It copies the robots (.github/workflows/*.yml), README.md and .gitignore from the soundcheck-data
// clone (--from, default ../soundcheck-data), and creates projects/<film-id>/ with:
//   film.json (id, name, tag — the same format the app writes), empty characters / transmitters /
//   lavaliers / schedule ([]), scenes.json ({}), settings.json ({}) and inbox.json with an empty
//   Gmail search (fill it in before the first production email).
// It never pushes and never talks to GitHub: the next steps are printed at the end.
// Uses only node itself (no packages). Tested in tests/new-film-repo.test.js.

import { readFile, writeFile, mkdir, readdir, copyFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectToFiles, formatJson } from '../src/store/repo-files.js';

const USAGE = 'Usage: node tools/new-film-repo.mjs <target-folder> <film-id> "<Film name>" <TAG> [--from <soundcheck-data clone>]';

// Reads the command line: { target, id, name, tag, from } (throws with the usage when incomplete).
export function readArguments(args) {
  const plain = [];
  let from = '../soundcheck-data';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') from = args[++i];
    else plain.push(args[i]);
  }
  const [target, id, name, tag] = plain;
  if (!target || !id || !name || !tag || !from) throw new Error(USAGE);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`The film id "${id}" must be small letters, numbers and dashes, e.g. film-x.`);
  return { target, id, name: name.trim(), tag: tag.trim(), from };
}

const exists = path => access(path).then(() => true, () => false);

// Creates the folder. Returns the list of files written (relative to the target).
export async function makeFilmRepo({ target, id, name, tag, from }) {
  const filmFolder = join(target, 'projects', id);
  if (await exists(join(filmFolder, 'film.json'))) throw new Error(`${filmFolder} already has a film.json: nothing changed.`);
  const written = [];
  const write = async (path, text) => {
    await mkdir(join(target, path, '..'), { recursive: true });
    await writeFile(join(target, path), text);
    written.push(path);
  };

  // the robots, the README and what git ignores: the same as in soundcheck-data
  const workflows = join(from, '.github', 'workflows');
  if (!(await exists(workflows))) throw new Error(`No robots found in ${workflows}: is --from a soundcheck-data clone?`);
  for (const file of (await readdir(workflows)).filter(file => file.endsWith('.yml')).sort()) {
    await write(`.github/workflows/${file}`, await readFile(join(workflows, file), 'utf8'));
  }
  for (const file of ['README.md', '.gitignore']) {
    if (await exists(join(from, file))) await write(file, await readFile(join(from, file), 'utf8'));
  }

  // the film's starting files, written exactly as the app writes them (repo-files.js)
  const emptyFilm = { id, name, tag, characters: [], transmitters: [], lavaliers: [], schedule: [],
    scenes: {}, settings: {}, presets: {} };
  for (const [path, content] of Object.entries(projectToFiles(emptyFilm))) {
    await write(`projects/${id}/${path}`, formatJson(content));
  }
  await write(`projects/${id}/inbox.json`, formatJson({ gmail_search: '' }));
  return written;
}

export function nextSteps({ target, id }) {
  return `
Ready: ${resolve(target)} (nothing was sent anywhere).
Next steps (docs/CREW_SHARING.md → "Setting up the next film"):
  1. Fill in projects/${id}/inbox.json → gmail_search (e.g. "subject:ODG has:attachment").
  2. On GitHub: create a new PRIVATE repo, empty (no README).
  3. In ${target}: git init -b main, git add -A, git commit -m "New film ${id}",
     git remote add origin <the new repo>, git push -u origin main
  4. The repo → Settings → Secrets → Actions: GMAIL_ADDRESS, GMAIL_APP_PASSWORD.
  5. Your GitHub key → Repository access → add the new repo.
  6. In the app: Projects → Film repos → Add repo (owner/name).
  7. Make the crew key for this repo only; the Gmail script's REPO property points to it.`;
}

// Run from the command line (not when a test imports it).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = readArguments(process.argv.slice(2));
    const written = await makeFilmRepo(options);
    for (const path of written) console.log(`  + ${path}`);
    console.log(nextSteps(options));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
