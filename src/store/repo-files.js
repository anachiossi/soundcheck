// repo-files.js — how a film is stored as small JSON files in the private
// soundcheck-data repo, and how changes from there are merged on the device.
// No network here (that's github.js): plain data in, plain data out.
// Used by: sync.js, tools/import-from-sheets.mjs
//
//   projects/<film-id>/
//     film.json            { format, version, id, name }
//     characters.json      [{ id, name, actor, color, pref_tx, pref_lav_model, pref_lav_color, … }]
//     transmitters.json    [{ id, model, color, connector, order }]
//     lavaliers.json       [{ id, model, color, connector, attenuated, brand }]
//     schedule.json        [{ scene_id, day, order, date, week, call, wrap }]
//     scenes.json          { '12': { int_ext, time_of_day, set, location, pages, story_day, synopsis, notes } }
//     presets/12.json      { scene_id, updated_at, updated_by, rows: [{ char_id, tx_id, lav_id, speaker }] }
//     proposals/odg-6.json changes suggested from a production email (see pipeline/), to accept or reject
//
// One file per scene preset: saving scene 12 never touches scene 13.

import { PROJECT_FORMAT } from '../model.js';

export const FILM_FORMAT = 'soundcheck-film';
const LISTS = ['characters', 'transmitters', 'lavaliers', 'schedule'];

export const presetFile = sceneId => `presets/${sceneId}.json`;

function sceneFromPath(relativePath) {
  const match = /^presets\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

export const proposalFile = id => `proposals/${id}.json`;

function proposalFromPath(relativePath) {
  const match = /^proposals\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

export function projectToFiles(project) {
  const files = { 'film.json': { format: FILM_FORMAT, version: 1, id: project.id, name: project.name } };
  for (const key of LISTS) files[`${key}.json`] = project[key];
  files['scenes.json'] = project.scenes || {};
  for (const [sceneId, preset] of Object.entries(project.presets)) files[presetFile(sceneId)] = preset;
  for (const [id, proposal] of Object.entries(project.proposals || {})) files[proposalFile(id)] = proposal;
  return files;
}

// A new, empty film on this device, ready to be filled by the first download.
export function emptyProject(film, folder) {
  return {
    format: PROJECT_FORMAT, version: 1, id: film.id, name: film.name, folder,
    characters: [], transmitters: [], lavaliers: [], schedule: [], scenes: {}, presets: {}, proposals: {},
    shas: {}, outbox: {}, conflicts: {}, data_as_of: null,
  };
}

/*  The OUTBOX lists the files changed on this device and not uploaded yet:
      { 'presets/12.json': { saved_at }, 'characters.json': { saved_at } }
    Their new content is already in the project; upload reads it with fileContent().
    CONFLICTS: files changed here AND in the repo, differently: { path: { theirs } }  */

// The content of one repo file, taken from the device's copy of the film.
export function fileContent(project, path) {
  const sceneId = sceneFromPath(path);
  if (sceneId) return project.presets[sceneId];
  const proposalId = proposalFromPath(path);
  if (proposalId) return project.proposals?.[proposalId];
  const key = path.replace(/\.json$/, '');
  if (key === 'film') return { format: FILM_FORMAT, version: 1, id: project.id, name: project.name };
  return project[key];
}

// Puts one repo file's content into the device's copy (changes `project`).
export function setFileContent(project, path, content) {
  const sceneId = sceneFromPath(path);
  const key = path.replace(/\.json$/, '');
  const proposalId = proposalFromPath(path);
  if (sceneId) project.presets = { ...project.presets, [sceneId]: content };
  else if (proposalId) project.proposals = { ...project.proposals, [proposalId]: content };
  else if (key === 'film') project.name = content.name;
  else if (LISTS.includes(key) || key === 'scenes') project[key] = content;
}

function sameContent(path, a, b) {
  if (sceneFromPath(path)) return sameRows(a?.rows, b?.rows);
  return JSON.stringify(a) === JSON.stringify(b);
}

/*  Merge what changed in the repo into the device's copy.
    changed:    { 'presets/12.json': content, 'schedule.json': content, … } files that differ from last time
    remoteShas: { relative path: sha } for EVERY file of the film in the repo now
    Rule: a file with an unsent change on this device (outbox) is never overwritten.
    If the repo changed that same file too, and differently, it becomes a conflict to decide.  */
export function applyRemote(project, changed, remoteShas) {
  const result = { ...project, outbox: { ...project.outbox }, conflicts: { ...project.conflicts } };

  for (const [path, content] of Object.entries(changed)) {
    if (!result.outbox[path]) setFileContent(result, path, content);
    else if (sameContent(path, fileContent(result, path), content)) delete result.outbox[path];
    else result.conflicts[path] = { theirs: content };
  }

  // Presets deleted in the repo disappear here too (unless changed on this device).
  for (const path of Object.keys(project.shas || {})) {
    const sceneId = sceneFromPath(path);
    if (sceneId && !(path in remoteShas) && !result.outbox[path]) {
      result.presets = { ...result.presets };
      delete result.presets[sceneId];
    }
  }

  result.shas = remoteShas;
  return result;
}

// Devices from before 28 Sep kept the outbox by scene number ('12'); now it's by file.
export function upgradeOutbox(project) {
  const toPath = key => (key.endsWith('.json') ? key : presetFile(key));
  const outbox = {};
  for (const [key, entry] of Object.entries(project.outbox || {})) outbox[toPath(key)] = { saved_at: entry.saved_at };
  const conflicts = {};
  for (const [key, entry] of Object.entries(project.conflicts || {})) conflicts[toPath(key)] = entry;
  return { ...project, outbox, conflicts };
}

// Which files must be downloaded: new or different from what this device has.
export function filesToDownload(project, remoteShas) {
  return Object.keys(remoteShas).filter(path => remoteShas[path] !== project.shas?.[path]);
}

// JSON text for the repo: readable, with each small record on one line, e.g.
//   { "char_id": "1", "tx_id": "3", "lav_id": "17", "speaker": "yes" },
export function formatJson(content) {
  const flatObject = /\{\n\s+([^{}[\]]*?)\n\s+\}/g;
  const text = JSON.stringify(content, null, 2).replace(flatObject, (whole, inner) => {
    const oneLine = `{ ${inner.replace(/\n\s+/g, ' ')} }`;
    return oneLine.length <= 170 ? oneLine : whole;
  });
  return text + '\n';
}

export function sameRows(a = [], b = []) {
  const plain = rows => JSON.stringify(rows.map(r => [r.char_id, r.tx_id, r.lav_id, r.speaker].map(String)));
  return plain(a) === plain(b);
}
