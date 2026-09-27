// banners.js — the bars that separate the schedule:
// Week banner (light blue)  "5 days · Week 2 · 28 Sep – 2 Oct"
// Day banner (slate grey)   "09:00 – 17:00 · Day 7 · Tue 29 Sep"
// Scene chips               small buttons, one per scene; tap to jump to it.
// Used by: screens/schedule.js

import { html } from '../../vendor/preact-htm.js';
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

export function SceneChips({ sceneIds, onPick, active }) {
  return html`
    <div class="chips">
      ${sceneIds.map(id => html`
        <button class=${'chip' + (active === id ? ' chip--on' : '')} key=${id} onClick=${() => onPick(id)}>${id}</button>`)}
    </div>`;
}
