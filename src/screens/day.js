// day.js — Today → Day: one shooting day: its banner, scene chips, every scene's mic table,
// 📄 ODG / 📄 Sides (when that day's PDFs are on the device) and 📷 Export (the day's image).
// A day with a 2nd unit (model.js → day.second) shows it after the main unit, under a violet
// "2nd unit" banner with its own hours, chips and 📷 Export 2nd unit (Ana, 3 Nov).
// Every scene can be edited right here (✎ on its title bar).
// Day pills (parts/day-strip.js, the same in Cues) turn green when the day is over;
// tapping the Day tab opens the day we are in.
// Used by: main.js (shareMics: screens/scenes.js, screens/lav-share.js)

import { html } from '../../vendor/preact-htm.js';
import { shootingDays, exportName, dayTag, shortDate, scheduleFor } from '../model.js';
import { setState } from '../state.js';
import { DayBanner, SecondUnitBanner, SceneChips } from '../parts/banners.js';
import { SceneTable } from '../parts/scene-table.js';
import { sceneSheet } from '../export/image.js';
import { shareCanvas } from '../export/share.js';
import { Icon } from '../parts/icons.js';
import { DayStrip } from '../parts/day-strip.js';
import { askImageFor } from '../parts/image-for.js';

// 'mics-sc14fin_D10_02.10.26.png' (with the scene's shooting day, when it has one)
export const sceneFileName = (project, sceneId) => {
  const row = scheduleFor(project, sceneId);
  return `mics-sc${sceneId}${row ? `_${dayTag(row.day)}_${shortDate(row.date)}` : ''}.png`;
};

const scrollToScene = id => document.getElementById('scene-' + id)?.scrollIntoView({ behavior: 'smooth' });

// a scene's or a day's image: first "Image for: Sound mixer · Sound assistants" (parts/image-for.js)
export async function shareMics(project, sceneIds, title, fileName) {
  const audience = await askImageFor();
  if (!audience) return;
  const name = audience === 'assistants' ? fileName.replace(/^mics/, 'rig') : fileName;
  await shareCanvas(await sceneSheet(project, sceneIds, title, audience), exportName(project, name));
}

const exportScene = (project, sceneId) => shareMics(project, [sceneId], `Scene ${sceneId}`, sceneFileName(project, sceneId));

// 📄 ODG / 📄 Sides / 🗺 Map, then the day's other papers by their own name ('IC PROTOCOLLO SET CHIUSO'):
// every file the robot filed in docs/day-<n>/ (pipeline/day_documents.py), shown once it is on this device.
const FIRST = { odg: 'ODG', sides: 'Sides', map: 'Map' };

function dayDocuments(project, day) {
  const folder = `${project.folder}/docs/day-${day}/`;
  const found = Object.keys(project.documents || {}).filter(path => path.startsWith(folder)).map(path => {
    const [, name, extension] = /^(.*)\.(\w+)$/.exec(path.slice(folder.length));
    const map = /^map(-\d+)?$/.exec(name);
    const label = FIRST[name] || (map ? `Map ${map[1] ? map[1].slice(1) : ''}`.trim() : name.replace(/_/g, ' '));
    return { path, name, extension, label, icon: map ? 'map' : 'document' };
  });
  const order = paper => { // ODG, Sides, Map first; the other papers after them
    const place = Object.keys(FIRST).indexOf(paper.name.replace(/-\d+$/, ''));
    return place === -1 ? 99 : place;
  };
  return found.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
}

function DocumentButtons({ project, day }) {
  const date = shortDate(shootingDays(project).find(d => d.day === day)?.date);
  return dayDocuments(project, day).map(paper => html`<button class="btn btn--doc" key=${paper.path}
      onClick=${() => setState({ screen: 'document', documentPath: paper.path, documentTitle: `${paper.label} · Day ${day}`, documentFile: `${paper.name === 'odg' ? 'ODG' : paper.name}_${dayTag(day)}_${date}.${paper.extension}`, documentFrom: 'day' })}><${Icon} name=${paper.icon} /> ${paper.label}</button>`);
}

export function DayScreen({ state }) {
  const { project, edit } = state;
  const days = shootingDays(project);
  const day = days.find(d => d.day === state.day) || days[0];
  if (!day) return html`<p class="empty">No schedule in this project.</p>`;
  const sceneIds = day.scenes.map(s => String(s.scene_id));
  const secondIds = (day.second?.scenes || []).map(s => String(s.scene_id));

  return html`
    <${DayStrip} days=${days} chosen=${day.day} />
    <${DayBanner} day=${day} />
    <${SceneChips} project=${project} sceneIds=${sceneIds} onPick=${scrollToScene} />
    <div class="toolbar">
      <${DocumentButtons} project=${project} day=${day.day} />
      <button class="btn" onClick=${() => shareMics(project, sceneIds, `Day ${day.day} · mic list`, `mics_${dayTag(day.day)}_${shortDate(day.date)}.png`)}><${Icon} name="image" /> Export</button>
    </div>
    ${sceneIds.map(id => html`<${SceneTable} key=${id} project=${project} edit=${edit} sceneId=${id} onExport=${id => exportScene(project, id)} />`)}
    ${day.second && html`
      <${SecondUnitBanner} second=${day.second} />
      <${SceneChips} project=${project} sceneIds=${secondIds} onPick=${scrollToScene} />
      <div class="toolbar">
        <button class="btn" onClick=${() => shareMics(project, secondIds, `Day ${day.day} · 2nd unit · mic list`, `mics_${dayTag(day.day)}_2nd-unit_${shortDate(day.date)}.png`)}><${Icon} name="image" /> Export 2nd unit</button>
      </div>
      ${secondIds.map(id => html`<${SceneTable} key=${id} project=${project} edit=${edit} sceneId=${id} onExport=${id => exportScene(project, id)} />`)}`}`;
}
