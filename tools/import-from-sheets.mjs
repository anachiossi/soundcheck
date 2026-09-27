// import-from-sheets.mjs — moves a film out of the old Google Sheets into
// JSON files in the private soundcheck-data repo (one-time, per film).
//
//   node tools/import-from-sheets.mjs <film folder in soundcheck-data>
//
// The folder must contain _import/sources.json:
//   { "id": "...", "name": "...", "sources": { ...see tools/sheets.js... } }
// Optional in _import/: schedule.csv (if the schedule sheet isn't published)
// and scene_info.json (INT/EXT, set, synopsis… from the script breakdown).
// Writes film.json, characters.json, …, presets/<scene>.json into the folder.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchFromSheets, scheduleFromCsv } from './sheets.js';
import { projectToFiles, formatJson } from '../src/store/repo-files.js';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node tools/import-from-sheets.mjs <film folder>');
  process.exit(1);
}
const importDir = join(folder, '_import');
const optional = (name, parse) => readFile(join(importDir, name), 'utf8').then(parse, () => null);

const config = JSON.parse(await readFile(join(importDir, 'sources.json'), 'utf8'));
const data = await fetchFromSheets(config.sources);
data.schedule ??= await optional('schedule.csv', scheduleFromCsv);
if (!data.schedule) throw new Error('No schedule: publish the schedule sheet or add _import/schedule.csv');
const scenes = (await optional('scene_info.json', JSON.parse)) || {};

const now = new Date().toISOString();
for (const preset of Object.values(data.presets)) preset.updated_by = 'import from Sheets';
const files = projectToFiles({ id: config.id, name: config.name, ...data, scenes });

await mkdir(join(folder, 'presets'), { recursive: true });
for (const [path, content] of Object.entries(files)) {
  await writeFile(join(folder, path), formatJson(content));
}
console.log(`${now}: wrote ${Object.keys(files).length} files into ${folder}`);
console.log(`${data.characters.length} characters · ${data.transmitters.length} TX · ${data.lavaliers.length} lavs · ` +
  `${data.schedule.length} scheduled scenes · ${Object.keys(data.presets).length} presets · ${Object.keys(scenes).length} scene infos`);
