// banners.js — the bars that separate the schedule:
// Week banner (light blue)  "5 days · Week 2 · 28 Sep – 2 Oct"
// Day banner (slate grey)   "09:00 – 17:00 · Day 7 · Tue 29 Sep"
// 2nd unit banner (violet)  "08:00 – 16:00 · 2nd unit · De Feudis", above that unit's scenes
// Scene chips               small buttons, one per scene (tinted by its dificultômetro level); tap to jump to it.
// Used by: screens/schedule.js

import { html } from '../../vendor/preact-htm.js';
import { ScenePill } from './scene-pill.js';
import { formatDate } from '../model.js';

export function WeekBanner({ week }) {
  const first = week.days[0];
  const last = week.days[week.days.length - 1];
  const count = week.days.length;
  return html`
    <div class="banner banner--week">
      <span>${count} ${count === 1 ? 'day' : 'days'}</span>
      <b>Week ${week.week}</b>
      <span>${formatDate(first.date)} – ${formatDate(last.date)}</span>
    </div>`;
}

export function DayBanner({ day, children }) {
  const hours = day.call && day.wrap ? `${day.call} – ${day.wrap}` : '';
  return html`
    <div class="banner banner--day">
      <span>${hours}</span>
      <b>Day ${day.day}</b>
      <span>${formatDate(day.date, { weekday: true })}</span>
    </div>
    ${children}`;
}

// The 2nd unit of a day (violet): "08:00 – 16:00 · 2nd unit · De Feudis". The name is the one the PDL prints
// (Ana, 3 Nov: behind the scenes it is "2nd unit", the name stays visible). No hours printed → said so.
export function SecondUnitBanner({ second, children }) {
  const hours = second.call && second.wrap ? `${second.call} – ${second.wrap}` : 'hours not given';
  return html`
    <div class="banner banner--unit2">
      <span>${hours}</span>
      <b>2nd unit</b>
      <span>${second.name}</span>
    </div>
    ${children}`;
}

export function SceneChips({ project, sceneIds, onPick, active }) {
  return html`
    <div class="chips">
      ${sceneIds.map(id => html`
        <${ScenePill} key=${id} project=${project} sceneId=${id} active=${active === id} onClick=${() => onPick(id)} />`)}
    </div>`;
}
