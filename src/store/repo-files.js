// repo-files.js — how a film is stored as small JSON files in the private
// soundcheck-data repo, and how changes from there are merged on the device.
// No network here (that's github.js): plain data in, plain data out.
// Used by: sync.js, tools/import-from-sheets.mjs
//
//   projects/<film-id>/
//     film.json            { format, version, id, name }
//     characters.json      [{ id, name, actor, color }]
//     transmitters.json    [{ id, model, color, connector, order }]
//     lavaliers.json       [{ id, model, color, connector, attenuated, brand }]
//     schedule.json        [{ scene_id, day, order, date, week, call, wrap }]
//     scenes.json          { '12': { int_ext, time_of_day, set, location, pages, story_day, synopsis, notes } }
//     presets/12.json      { scene_id, updated_at, updated_by, rows: [{ char_id, tx_id, lav_id, speaker }] }
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

export function projectToFiles(project) {
  const files = { 'film.json': { format: FILM_FORMAT, version: 1, id: project.id, name: project.name } };
  for (const key of LISTS) files[`${key}.json`] = project[key];
  files['scenes.json'] = project.scenes || {};
  for (const [sceneId, preset] of Object.entries(project.presets)) files[presetFile(sceneId)] = preset;
  return files;
}

// A new, empty film on this device, ready to be filled by the first download.
export function emptyProject(film, folder) {
  return {
    format: PROJECT_FORMAT, version: 1, id: film.id, name: film.name, folder,
    characters: [], transmitters: [], lavaliers: [], schedule: [], scenes: {}, presets: {},
    shas: {}, outbox: {}, conflicts: {}, data_as_of: null,
  };
}

/*  Merge what changed in the repo into the device's copy.
    changed:    { 'presets/12.json': content, 'schedule.json': content, … } files that differ from last time
    remoteShas: { relative path: sha } for EVERY file of the film in the repo now
    Rule: a scene with an unsent change on this device (outbox) is never overwritten.
    If the repo changed that same scene too, and differently, it becomes a conflict to decide.  */
export function applyRemote(project, changed, remoteShas) {
  const result = {
    ...project,
    presets: { ...project.presets },
    outbox: { ...project.outbox },
    conflicts: { ...project.conflicts },
  };

  for (const [path, content] of Object.entries(changed)) {
    const sceneId = sceneFromPath(path);
    if (!sceneId) {
      const key = path.replace(/\.json$/, '');
      if (key === 'film') result.name = content.name;
      else if (LISTS.includes(key) || key === 'scenes') result[key] = content;
      continue;
    }
    const mine = result.outbox[sceneId];
    if (!mine) result.presets[sceneId] = content;
    else if (sameRows(mine.rows, content.rows)) delete result.outbox[sceneId];
    else result.conflicts[sceneId] = { theirs: content };
  }

  // Presets deleted in the repo disappear here too (unless changed on this device).
  for (const path of Object.keys(project.shas || {})) {
    const sceneId = sceneFromPath(path);
    if (sceneId && !(path in remoteShas) && !result.outbox[sceneId]) delete result.presets[sceneId];
  }

  result.shas = remoteShas;
  return result;
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
    return oneLine.length <= 110 ? oneLine : whole;
  });
  return text + '\n';
}

export function sameRows(a = [], b = []) {
  const plain = rows => JSON.stringify(rows.map(r => [r.char_id, r.tx_id, r.lav_id, r.speaker].map(String)));
  return plain(a) === plain(b);
}
