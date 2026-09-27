// snapshot.mjs — builds a project file from the Google Sheets, on the laptop.
// Same conversion code as the app's "Refresh" button (src/store/sheets.js).
//
//   node tools/snapshot.mjs <project folder>
//
// The folder (in the PRIVATE soundcheck-data repo) must contain sources.json:
//   { "id": "...", "name": "...", "sources": { ...see sheets.js... } }
// and may contain schedule.csv, used when the schedule sheet isn't published.
// Writes <folder>/<id>.soundcheck.json

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchFromSheets, scheduleFromCsv } from '../src/store/sheets.js';
import { PROJECT_FORMAT } from '../src/model.js';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node tools/snapshot.mjs <project folder>');
  process.exit(1);
}

const config = JSON.parse(await readFile(join(folder, 'sources.json'), 'utf8'));
const data = await fetchFromSheets(config.sources);

if (!data.schedule) {
  const localCsv = join(folder, 'schedule.csv');
  const exists = await access(localCsv).then(() => true, () => false);
  if (!exists) throw new Error('Schedule sheet not readable and no schedule.csv in the folder.');
  data.schedule = scheduleFromCsv(await readFile(localCsv, 'utf8'));
  console.log('schedule: from local schedule.csv');
}

const project = {
  format: PROJECT_FORMAT,
  version: 1,
  id: config.id,
  name: config.name,
  data_as_of: new Date().toISOString(),
  sources: config.sources,
  ...data,
};

const out = join(folder, `${config.id}.soundcheck.json`);
await writeFile(out, JSON.stringify(project, null, 1));
console.log(`wrote ${out}`);
console.log(`${project.characters.length} characters · ${project.transmitters.length} TX · ` +
  `${project.lavaliers.length} lavs · ${project.schedule.length} scheduled scenes · ` +
  `${Object.keys(project.presets).length} presets`);
