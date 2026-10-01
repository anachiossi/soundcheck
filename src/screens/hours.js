// hours.js — the Hours screen (Projects → ⏱ Hours, or the ⏱ in the top bar): one week of shooting days, Monday to Sunday,
// for production: call and wrap of the ODG, the REAL wrap, hours worked and overtime, and the total.
//   • ‹ › other weeks · tap a day's real wrap to type it (also for days already gone)
//   • the film's working day (8h continuate…) decides where overtime starts (hours-rules.js)
//   • Week / Whole film → the hours as an image for production (the film: week by week, with totals)
//   • 🔔 Wrap alerts: a notification at the wrap, even with the app closed (parts/wrap-alerts.js)
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { formatDate, exportName, shortDate, weekTag } from '../model.js';
import { WORKDAYS, workdayOf, weekOf, filmWeeks, mondayOf, hm } from '../hours-rules.js';
import { wrappedAt, setWorkday } from '../hours-editing.js';
import { hoursImage } from '../export/hours-image.js';
import { shareCanvas } from '../export/share.js';
import { Icon } from '../parts/icons.js';
import { WrapAlerts } from '../parts/wrap-alerts.js';

export function HoursScreen({ state }) {
  const { project } = state;
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [editing, setEditing] = useState(null); // { day, time }
  const days = weekOf(project, monday);
  const kind = workdayOf(project);
  const total = days.reduce((sum, d) => sum + (d.extra || 0), 0);
  const move = weeks => setMonday(m => { const next = new Date(m); next.setDate(next.getDate() + 7 * weeks); return next; });
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const title = `${formatDate(iso(monday))} – ${formatDate(iso(sunday))}`;

  return html`
    <div class="hours">
      <div class="hours__week">
        <button class="btn" onClick=${() => move(-1)} aria-label="Week before">‹</button>
        <b>${title}</b>
        <button class="btn" onClick=${() => move(1)} aria-label="Week after">›</button>
      </div>
      <label class="hours__kind">Working day
        <select value=${kind || ''} onChange=${e => setWorkday(e.target.value)}>
          ${!kind && html`<option value="">choose…</option>`}
          ${Object.entries(WORKDAYS).map(([id, w]) => html`<option key=${id} value=${id}>${w.label}</option>`)}
        </select>
      </label>
      <div class="hours__export">
        <button class="btn" disabled=${days.length === 0} onClick=${async () => shareCanvas(await hoursImage(project, [{ monday, days }], title), exportName(project, `hours_${days[0]?.week ? `${weekTag(days[0].week)}_` : ''}${shortDate(iso(monday))}.png`))}>
          <${Icon} name="image" /> Week</button>
        <button class="btn" onClick=${async () => shareCanvas(await hoursImage(project, filmWeeks(project), project.name), exportName(project, 'hours_ALL-FILM.png'))}>
          <${Icon} name="image" /> Whole film</button>
      </div>
      ${days.length === 0 ? html`<p class="empty">No shooting this week.</p>` : html`
        <table class="hours__table">
          <thead><tr><th>Day</th><th>Call</th><th>ODG wrap</th><th>Wrap</th><th>Worked</th><th>Extra</th></tr></thead>
          <tbody>
            ${days.map(d => html`
              <tr key=${d.day}>
                <td><b>D${d.day}</b> <small>${formatDate(d.date, { weekday: true })}</small></td>
                <td>${d.call || '—'}</td>
                <td>${d.wrap || '—'}</td>
                <td>${editing?.day === d.day ? html`
                  <input type="time" value=${editing.time} onInput=${e => setEditing({ day: d.day, time: e.target.value })}
                         onBlur=${() => { if (editing.time) wrappedAt(d.day, editing.time); setEditing(null); }} aria-label="Real wrap" autofocus />`
                  : html`<button class="hours__wrap" onClick=${() => setEditing({ day: d.day, time: d.real_wrap || d.wrap || '' })}>
                      ${d.real_wrap || (d.late ? 'still on' : '?')}</button>`}</td>
                <td>${hm(d.worked)}</td>
                <td class=${d.extra ? 'hours__extra' : ''}>${d.extra ? `+${hm(d.extra)}` : d.extra === 0 ? '—' : ''}</td>
              </tr>`)}
          </tbody>
          <tfoot><tr><td colspan="5">Overtime this week</td><td class=${total ? 'hours__extra' : ''}>${total ? `+${hm(total)}` : '—'}</td></tr></tfoot>
        </table>`}
      <div class="hours__alerts"><${WrapAlerts} project=${project} /></div>
    </div>`;
}
