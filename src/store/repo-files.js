// repo-files.js — how a film is stored as small JSON files in the private
// soundcheck-data repo, and how changes from there are merged on the device.
// No network here (that's github.js): plain data in, plain data out.
// Used by: sync.js, tools/import-from-sheets.mjs
//
//   projects/<film-id>/
//     film.json            { format, version, id, name, tag }   tag: 'LBE', starts exported files' names
//     characters.json      [{ id, name, actor, color, pref_tx, pref_lav_model, pref_lav_color, … }]
//     transmitters.json    [{ id, model, color, connector, order, frequency, serial }]
//     lavaliers.json       [{ id, model, color, connector, attenuated, brand }]
//     schedule.json        [{ scene_id, day, order, date, week, call, wrap }]
//     scenes.json          { '12': { int_ext, time_of_day, set, location, pages, story_day, synopsis, notes } }
//     presets/12.json      { scene_id, updated_at, updated_by, rows: [{ char_id, tx_id, lav_id, speaker }] }
//     proposals/odg-6.json changes suggested from a production email (see pipeline/), to accept or reject
//     lines/sides/2.json   who says what in scene 2 (from the day's sides; lines/script/2.json from the script;
//                          lines/set/2.json = changed on set in 🎙 Cues, wins over both)
//     sound/12.json        { scene_id, level 1–5, reason, flags, notes, warnings: [{ char_id, kind, text }] }
//                          the sound breakdown (dificultômetro + lav warnings), see sound-rules.js
//     hours/9.json         { day, date, status: 'wrapped' | 'late', real_wrap, snooze_until } the REAL wrap of
//                          shooting day 9 (hours-rules.js); one file per day, like the presets
//     push/ana-iphone.json { endpoint, keys, device } where to send wrap alerts (parts/wrap-alerts.js);
//                          read by the robot (pipeline/send_push.py), one file per phone
//     settings.json        this film's own rules: presets (the generator), voices (read aloud), workday
//     ifb/crew.json        [{ id, name, job, color, phone }]          IFB department:
//     ifb/receivers.json   [{ id, model, color, connector }]
//     ifb/headphones.json  [{ id, model, color, connector, attenuated }]
//     ifb/list.json        { updated_at, rows: [{ crew_id, rx_id, hp_id, out }] }  one list for the film
//     gear/categories.json [{ id, name, color, parent }]   Gear department (gear-rules.js): categories
//     gear/items.json      [{ id, name, category, qty, inside, volume, note, added, removed, removed_note }]
//     gear/history.json    [{ at, item, name, what, note }]   what entered / left / changed (not ticks, not moves)
//     gear/checks.json     { item id: true }                  today's ticks (truck, case contents)
//
// One file per scene preset: saving scene 12 never touches scene 13.

import { PROJECT_FORMAT } from '../model.js';

export const FILM_FORMAT = 'soundcheck-film';
const LISTS = ['characters', 'transmitters', 'lavaliers', 'schedule'];
// IFB files and the name each one has in the device's copy of the film
export const GEAR_FILES = { 'gear/categories.json': 'gearCategories', 'gear/items.json': 'gearItems',
  'gear/history.json': 'gearHistory', 'gear/checks.json': 'gearChecks' };
export const IFB_FILES = { 'ifb/crew.json': 'crew', 'ifb/receivers.json': 'ifbReceivers',
  'ifb/headphones.json': 'ifbHeadphones', 'ifb/list.json': 'ifbList' };

// files kept under a name in the device's copy of the film (IFB and Gear lists)
const NAMED_FILES = { ...IFB_FILES, ...GEAR_FILES };

const filmFile = project => ({ format: FILM_FORMAT, version: 1, id: project.id, name: project.name, ...(project.tag ? { tag: project.tag } : {}) });

export const presetFile = sceneId => `presets/${sceneId}.json`;

function sceneFromPath(relativePath) {
  const match = /^presets\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

export const proposalFile = id => `proposals/${id}.json`;
export const soundFile = sceneId => `sound/${sceneId}.json`;
export const hoursFile = day => `hours/${day}.json`;
export const pushFile = phone => `push/${phone}.json`;

function pushFromPath(relativePath) {
  const match = /^push\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

function hoursFromPath(relativePath) {
  const match = /^hours\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

function soundFromPath(relativePath) {
  const match = /^sound\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

// 'lines/sides/2.json' → 'sides/2'
function linesFromPath(relativePath) {
  const match = /^lines\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

function proposalFromPath(relativePath) {
  const match = /^proposals\/(.+)\.json$/.exec(relativePath);
  return match ? match[1] : null;
}

export function projectToFiles(project) {
  const files = { 'film.json': filmFile(project) };
  for (const key of LISTS) files[`${key}.json`] = project[key];
  files['scenes.json'] = project.scenes || {};
  if (project.settings) files['settings.json'] = project.settings;
  for (const [sceneId, preset] of Object.entries(project.presets)) files[presetFile(sceneId)] = preset;
  for (const [id, proposal] of Object.entries(project.proposals || {})) files[proposalFile(id)] = proposal;
  for (const [key, lines] of Object.entries(project.lines || {})) files[`lines/${key}.json`] = lines;
  for (const [sceneId, sound] of Object.entries(project.sound || {})) files[soundFile(sceneId)] = sound;
  for (const [day, hours] of Object.entries(project.hours || {})) files[hoursFile(day)] = hours;
  for (const [phone, push] of Object.entries(project.push || {})) files[pushFile(phone)] = push;
  for (const [path, key] of Object.entries(NAMED_FILES)) if (project[key]) files[path] = project[key];
  return files;
}

// A new, empty film on this device, ready to be filled by the first download.
export function emptyProject(film, folder) {
  return {
    format: PROJECT_FORMAT, version: 1, id: film.id, name: film.name, folder,
    characters: [], transmitters: [], lavaliers: [], schedule: [], scenes: {}, presets: {}, proposals: {}, lines: {}, sound: {}, hours: {}, push: {}, settings: {},
    crew: [], ifbReceivers: [], ifbHeadphones: [], ifbList: { rows: [] },
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
  const linesKey = linesFromPath(path);
  if (linesKey) return project.lines?.[linesKey];
  if (soundFromPath(path)) return project.sound?.[soundFromPath(path)];
  if (hoursFromPath(path)) return project.hours?.[hoursFromPath(path)];
  if (pushFromPath(path)) return project.push?.[pushFromPath(path)];
  if (NAMED_FILES[path]) return project[NAMED_FILES[path]];
  const key = path.replace(/\.json$/, '');
  if (key === 'film') return filmFile(project);
  return project[key];
}

// Puts one repo file's content into the device's copy (changes `project`).
export function setFileContent(project, path, content) {
  const sceneId = sceneFromPath(path);
  const key = path.replace(/\.json$/, '');
  const proposalId = proposalFromPath(path);
  if (sceneId) project.presets = { ...project.presets, [sceneId]: content };
  else if (proposalId) project.proposals = { ...project.proposals, [proposalId]: content };
  else if (linesFromPath(path)) project.lines = { ...project.lines, [linesFromPath(path)]: content };
  else if (soundFromPath(path)) project.sound = { ...project.sound, [soundFromPath(path)]: content };
  else if (hoursFromPath(path)) project.hours = { ...project.hours, [hoursFromPath(path)]: content };
  else if (pushFromPath(path)) project.push = { ...project.push, [pushFromPath(path)]: content };
  else if (NAMED_FILES[path]) project[NAMED_FILES[path]] = content;
  else if (key === 'film') Object.assign(project, { name: content.name, tag: content.tag || '' });
  else if (LISTS.includes(key) || key === 'scenes' || key === 'settings') project[key] = content;
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

// Which files must be downloaded: new or different from what this device has, or
// marked as received but missing (an older app version skipped kinds of files it
// didn't know yet, like lines/ before 🎙 Cues).
export function filesToDownload(project, remoteShas) {
  return Object.keys(remoteShas).filter(path => isAppFile(path) &&
    (remoteShas[path] !== project.shas?.[path] || fileContent(project, path) === undefined));
}

// The kinds of files the app uses (the folder also holds e.g. inbox.json for the pipeline).
function isAppFile(path) {
  const key = path.replace(/\.json$/, '');
  return Boolean(sceneFromPath(path) || proposalFromPath(path) || linesFromPath(path) || soundFromPath(path) || hoursFromPath(path) || pushFromPath(path) || NAMED_FILES[path]
    || key === 'film' || key === 'scenes' || key === 'settings' || LISTS.includes(key));
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
