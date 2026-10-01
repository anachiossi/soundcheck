// schedule.js — the Schedule screen: the film by Day, by Week or All film.
// Day:  pick a shooting day → its banner, scene chips, every scene's mic table,
//       📄 ODG / 📄 Sides (when that day's PDFs are on the device), 📷 Export (the day's image).
// Week: every day of the week, one after the other, + 📷 Week image.
// All:  an overview of every week and day; tap a day to open it. + 📷 All film.
// Every scene can be edited right here (✎ on its title bar).
// Day pills (parts/day-strip.js, the same in Cues) turn green when the day is over;
// tapping the Schedule tab opens the day we are in.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { shootingDays, weeks, unscheduledScenes, formatDate, exportName } from '../model.js';
import { setScheduleMode, pickDay, pickWeek, setState } from '../state.js';
import { WeekBanner, DayBanner, SceneChips } from '../parts/banners.js';
import { SceneTable } from '../parts/scene-table.js';
import { sceneSheet } from '../export/image.js';
import { scheduleImages } from '../export/schedule-images.js';
import { shareCanvas, shareCanvases } from '../export/share.js';
import { Icon } from '../parts/icons.js';
import { ScenePill } from '../parts/scene-pill.js';
import { DayStrip } from '../parts/day-strip.js';

const MODES = [['day', 'Day'], ['week', 'Week'], ['all', 'All film']];

export function ScheduleScreen({ state }) {
  const { project, scheduleMode } = state;
  return html`
    <div class="segmented">
      ${MODES.map(([mode, label]) => html`
        <button class=${scheduleMode === mode ? 'on' : ''} onClick=${() => setScheduleMode(mode)}>${label}</button>`)}
    </div>
    ${scheduleMode === 'day' && html`<${DayView} project=${project} edit=${state.edit} dayNumber=${state.day} />`}
    ${scheduleMode === 'week' && html`<${WeekView} project=${project} edit=${state.edit} weekNumber=${state.week} />`}
    ${scheduleMode === 'all' && html`<${AllView} project=${project} />`}`;
}

// Long images can take a few seconds: show "Making images…" meanwhile.
async function exportDays(project, dayNumbers, title, fileName) {
  setState({ busyText: 'Making images…' });
  try {
    await shareCanvases(await scheduleImages(project, dayNumbers, title), exportName(project, fileName));
  } finally {
    setState({ busyText: null });
  }
}

const scrollToScene = id => document.getElementById('scene-' + id)?.scrollIntoView({ behavior: 'smooth' });

async function exportScene(project, sceneId) {
  await shareCanvas(await sceneSheet(project, [sceneId], `Scene ${sceneId}`), exportName(project, `scene-${sceneId}.png`));
}

// 📄 ODG / 📄 Sides: only shown once that day's PDF is on this device.
function DocumentButtons({ project, day }) {
  const kinds = [['odg', 'ODG'], ['sides', 'Sides']];
  return kinds.map(([file, label]) => {
    const path = `${project.folder}/docs/day-${day}/${file}.pdf`;
    if (!project.documents?.[path]) return null;
    return html`<button class="btn btn--doc" key=${file}
      onClick=${() => setState({ screen: 'document', documentPath: path, documentTitle: `${label} · Day ${day}` })}><${Icon} name="document" /> ${label}</button>`;
  });
}

function DayView({ project, edit, dayNumber }) {
  const days = shootingDays(project);
  const day = days.find(d => d.day === dayNumber) || days[0];
  if (!day) return html`<p class="empty">No schedule in this project.</p>`;
  const sceneIds = day.scenes.map(s => String(s.scene_id));

  return html`
    <${DayStrip} days=${days} chosen=${day.day} />
    <${DayBanner} day=${day} />
    <${SceneChips} project=${project} sceneIds=${sceneIds} onPick=${scrollToScene} />
    <div class="toolbar">
      <${DocumentButtons} project=${project} day=${day.day} />
      <button class="btn" onClick=${async () => shareCanvas(await sceneSheet(project, sceneIds, `Day ${day.day} · mic list`), exportName(project, `day-${day.day}.png`))}><${Icon} name="image" /> Export</button>
    </div>
    ${sceneIds.map(id => html`<${SceneTable} key=${id} project=${project} edit=${edit} sceneId=${id} onExport=${id => exportScene(project, id)} />`)}`;
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
      <button class="btn" onClick=${() => exportDays(project, week.days.map(d => d.day), `Week ${week.week} · mic list`, `week-${week.week}.png`)}><${Icon} name="image" /> Week image</button>
    </div>
    <${WeekBanner} week=${week} />
    ${week.days.map(day => html`
      <${DayBanner} key=${day.day} day=${day}>
        ${day.scenes.map(s => html`<${SceneTable} key=${s.scene_id} project=${project} edit=${edit} sceneId=${String(s.scene_id)}
                                                 onExport=${id => exportScene(project, id)} />`)}
      <//>`)}`;
}

function AllView({ project }) {
  const all = weeks(project);
  const days = all.reduce((n, w) => n + w.days.length, 0);
  const unscheduled = unscheduledScenes(project);
  return html`
    <p class="summary"><b>${days} shooting days</b> · ${all.length} weeks · ${Object.keys(project.presets).length} presets</p>
    <div class="toolbar">
      <button class="btn" onClick=${() => exportDays(project, shootingDays(project).map(d => d.day), `${project.name} · all film`, 'all-film.png')}><${Icon} name="image" /> All film image</button>
    </div>
    ${all.map(week => html`
      <div key=${week.week}>
        <${WeekBanner} week=${week} />
        ${week.days.map(day => html`
          <button key=${day.day} class="day-line" onClick=${() => pickDay(day.day)}>
            <span class="day-line__title"><b>Day ${day.day}</b> · ${formatDate(day.date, { weekday: true })}
              ${day.call && html`<small> · ${day.call}–${day.wrap}</small>`}</span>
            <span class="day-line__scenes">${day.scenes.map(s => html`<${ScenePill} key=${s.scene_id} project=${project} sceneId=${String(s.scene_id)} />`)}</span>
          </button>`)}
      </div>`)}
    ${unscheduled.length > 0 && html`
      <div class="banner banner--week"><span></span><b>Unscheduled</b><span>${unscheduled.length} scenes</span></div>
      <div class="chips">${unscheduled.map(id => html`<${ScenePill} key=${id} project=${project} sceneId=${id} />`)}</div>`}`;
}
