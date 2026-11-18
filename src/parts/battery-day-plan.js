// battery-day-plan.js — the card on top of Gear → Batteries: how many batteries the next shooting day will use (battery-day.js).
// Used by: screens/gear-batteries.js

import { html } from '../../vendor/preact-htm.js';
import { formatDate } from '../model.js';
import { clock } from '../battery-rules.js';
import { batteryPlan, nextDay } from '../battery-day.js';

export function BatteryDayPlan({ project }) {
  const day = nextDay(project);
  if (!day) return null;
  const { minutes, lines } = batteryPlan(project, day);
  if (!lines.length) return null;
  return html`
    <section class="battery-plan">
      <h2 class="section-title">Day ${day.day} · ${formatDate(day.date, { weekday: true })} · ${clock(minutes)} h</h2>
      ${lines.map(line => html`
        <div class="battery-plan__line" key=${line.battery}>
          <p><b>${line.battery}</b>: needs <b>${line.need}</b> of ${line.have}${' '}
            <span class=${line.spare < 0 ? 'warn-text' : 'muted'}>${line.spare < 0 ? `${-line.spare} short` : `${line.spare} spare`}</span></p>
          ${line.models.map(model => html`
            <p class="muted" key=${model.model}>${model.count} ${model.model} × ${model.takes} × ${model.changes} sets, a change every ${clock(model.life)} h</p>`)}
        </div>`)}
    </section>`;
}
