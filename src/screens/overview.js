// overview.js — Today → Overview: the whole film in short, instead of the old Week and All film pages (Ana, 18 Nov).
// Each shooting day with its most lavaliers; each scene with its characters and how many speak.
// No presets and no mic tables here. Tap a day to open it.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { shootingDays, unscheduledScenes, sceneRows, formatDate } from '../model.js';
import { openDay } from '../state.js';
import { ScenePill } from '../parts/scene-pill.js';
import { dayMost, speakersText } from '../overview-rules.js';

function SceneLine({ project, sceneId }) {
  const names = sceneRows(project, sceneId).map(row => row.character?.name).filter(Boolean);
  return html`
    <div class="overview-scene">
      <${ScenePill} project=${project} sceneId=${sceneId} />
      <span class="overview-scene__names">${names.join(' · ')}</span>
      <span class="overview-scene__speakers">${speakersText(project, sceneId)}</span>
    </div>`;
}

function OverviewDay({ project, day }) {
  const { lavs } = dayMost(project, day);
  return html`
    <section class="overview-day">
      <button class="overview-day__head" onClick=${() => openDay(day.day)}>
        <b>Day ${day.day}</b> <span>${formatDate(day.date, { weekday: true })}</span>
        ${lavs > 0 && html`<span class="overview-day__lavs">most lavs ${lavs}</span>`}
      </button>
      ${day.scenes.map(scene => html`<${SceneLine} key=${scene.scene_id} project=${project} sceneId=${String(scene.scene_id)} />`)}
      ${day.second && html`
        <p class="overview-day__unit2"><span class="unit2-mark">2nd unit</span></p>
        ${day.second.scenes.map(scene => html`<${SceneLine} key=${scene.scene_id} project=${project} sceneId=${String(scene.scene_id)} />`)}`}
    </section>`;
}

export function OverviewScreen({ state }) {
  const { project } = state;
  const days = shootingDays(project);
  const unscheduled = unscheduledScenes(project);
  if (!days.length) return html`<p class="empty">No schedule in this project.</p>`;
  return html`
    <p class="summary"><b>${days.length} shooting days</b></p>
    ${days.map(day => html`<${OverviewDay} key=${day.day} project=${project} day=${day} />`)}
    ${unscheduled.length > 0 && html`
      <section class="overview-day">
        <p class="overview-day__head"><b>Unscheduled</b> <span>${unscheduled.length} scenes</span></p>
        ${unscheduled.map(id => html`<${SceneLine} key=${id} project=${project} sceneId=${id} />`)}
      </section>`}`;
}
