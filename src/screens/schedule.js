// schedule.js — the Schedule screen: the film as a Calendar (parts/month-calendar.js), by Day, by Week or All film.
// Day:  pick a shooting day → its banner, scene chips, every scene's mic table,
//       📄 ODG / 📄 Sides (when that day's PDFs are on the device), 📷 Export (the day's image).
// Week: every day of the week, one after the other, + 📷 Week image.
// All:  an overview of every week and day; tap a day to open it. + 📷 All film.
// A day with a 2nd unit (model.js → day.second) shows it after the main unit, under a violet
// "2nd unit" banner with its own hours, chips and 📷 Export 2nd unit (Ana, 3 Nov).
// Every scene can be edited right here (✎ on its title bar).
// Day pills (parts/day-strip.js, the same in Cues) turn green when the day is over;
// tapping the Schedule tab opens the day we are in.
// Used by: main.js (shareMics: screens/scenes.js, screens/lav-share.js)

import { html } from '../../vendor/preact-htm.js';
import { shootingDays, weeks, unscheduledScenes, formatDate, exportName, dayTag, weekTag, shortDate, scheduleFor } from '../model.js';
import { setScheduleMode, pickDay, pickWeek, setState } from '../state.js';
import { WeekBanner, DayBanner, SecondUnitBanner, SceneChips } from '../parts/banners.js';
import { SceneTable } from '../parts/scene-table.js';
import { sceneSheet } from '../export/image.js';
import { scheduleImages } from '../export/schedule-images.js';
import { shareCanvas, shareCanvases } from '../export/share.js';
import { Icon } from '../parts/icons.js';
import { ScenePill } from '../parts/scene-pill.js';
import { DayStrip } from '../parts/day-strip.js';
import { MonthCalendar } from '../parts/month-calendar.js';
import { askImageFor } from '../parts/image-for.js';

const MODES = [['calendar', 'Calendar'], ['day', 'Day'], ['week', 'Week'], ['all', 'All film']];

export function ScheduleScreen({ state }) {
  const { project, scheduleMode } = state;
  return html`
    <div class="segmented">
      ${MODES.map(([mode, label]) => html`
        <button class=${scheduleMode === mode ? 'on' : ''} onClick=${() => setScheduleMode(mode)}>${label}</button>`)}
    </div>
    ${scheduleMode === 'calendar' && html`<${MonthCalendar} project=${project} />`}
    ${scheduleMode === 'day' && html`<${DayView} project=${project} edit=${state.edit} dayNumber=${state.day} />`}
    ${scheduleMode === 'week' && html`<${WeekView} project=${project} edit=${state.edit} weekNumber=${state.week} />`}
    ${scheduleMode === 'all' && html`<${AllView} project=${project} />`}`;
}

// Long images can take a few seconds: show "Making images…" meanwhile.
// 'mics-sc14fin_D10_02.10.26.png' (with the scene's shooting day, when it has one)
export const sceneFileName = (project, sceneId) => {
  const row = scheduleFor(project, sceneId);
  return `mics-sc${sceneId}${row ? `_${dayTag(row.day)}_${shortDate(row.date)}` : ''}.png`;
};

async function exportDays(project, dayNumbers, title, fileName) {
  setState({ busyText: 'Making images…' });
  try {
    await shareCanvases(await scheduleImages(project, dayNumbers, title), exportName(project, fileName));
  } finally {
    setState({ busyText: null });
  }
}

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
      onClick=${() => setState({ screen: 'document', documentPath: paper.path, documentTitle: `${paper.label} · Day ${day}`, documentFile: `${paper.name === 'odg' ? 'ODG' : paper.name}_${dayTag(day)}_${date}.${paper.extension}`, documentFrom: 'schedule' })}><${Icon} name=${paper.icon} /> ${paper.label}</button>`);
}

function DayView({ project, edit, dayNumber }) {
  const days = shootingDays(project);
  const day = days.find(d => d.day === dayNumber) || days[0];
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

function WeekView({ project, edit, weekNumber }) {
  const all = weeks(project);
  const week = all.find(w => w.week === weekNumber) || all[0];
  if (!week) return html`<p class="empty">No schedule in this project.</p>`;
  return html`
    <div class="chips chips--big">
      ${all.map(w => html`
        <button key=${w.week} class=${'chip' + (w.week === week.week ? ' chip--on' : '')} onClick=${() => pickWeek(w.week)}>Week ${w.week}</button>`)}
    </div>
    <div class="toolbar">
      <button class="btn" onClick=${() => exportDays(project, week.days.map(d => d.day), `Week ${week.week} · mic list`, `mics_${weekTag(week.week)}_${shortDate(week.days[0]?.date)}.png`)}><${Icon} name="image" /> Week image</button>
    </div>
    <${WeekBanner} week=${week} />
    ${week.days.map(day => html`
      <${DayBanner} key=${day.day} day=${day}>
        ${day.scenes.map(s => html`<${SceneTable} key=${s.scene_id} project=${project} edit=${edit} sceneId=${String(s.scene_id)}
                                                 onExport=${id => exportScene(project, id)} />`)}
        ${day.second && html`
          <${SecondUnitBanner} second=${day.second}>
            ${day.second.scenes.map(s => html`<${SceneTable} key=${s.scene_id} project=${project} edit=${edit} sceneId=${String(s.scene_id)}
                                                            onExport=${id => exportScene(project, id)} />`)}
          <//>`}
      <//>`)}`;
}

function AllView({ project }) {
  const all = weeks(project);
  const days = all.reduce((n, w) => n + w.days.length, 0);
  const unscheduled = unscheduledScenes(project);
  return html`
    <p class="summary"><b>${days} shooting days</b> · ${all.length} weeks · ${Object.keys(project.presets).length} presets</p>
    <div class="toolbar">
      <button class="btn" onClick=${() => exportDays(project, shootingDays(project).map(d => d.day), `${project.name} · all film`, 'mics_ALL-FILM.png')}><${Icon} name="image" /> All film image</button>
    </div>
    ${all.map(week => html`
      <div key=${week.week}>
        <${WeekBanner} week=${week} />
        ${week.days.map(day => html`
          <button key=${day.day} class="day-line" onClick=${() => pickDay(day.day)}>
            <span class="day-line__title"><b>Day ${day.day}</b> · ${formatDate(day.date, { weekday: true })}
              ${day.call && html`<small> · ${day.call}–${day.wrap}</small>`}</span>
            <span class="day-line__scenes">${day.scenes.map(s => html`<${ScenePill} key=${s.scene_id} project=${project} sceneId=${String(s.scene_id)} />`)}</span>
            ${day.second && html`
              <span class="day-line__unit2"><span class="unit2-mark">2nd unit</span>
                ${day.second.scenes.map(s => html`<${ScenePill} key=${s.scene_id} project=${project} sceneId=${String(s.scene_id)} />`)}</span>`}
          </button>`)}
      </div>`)}
    ${unscheduled.length > 0 && html`
      <div class="banner banner--week"><span></span><b>Unscheduled</b><span>${unscheduled.length} scenes</span></div>
      <div class="chips">${unscheduled.map(id => html`<${ScenePill} key=${id} project=${project} sceneId=${id} />`)}</div>`}`;
}
