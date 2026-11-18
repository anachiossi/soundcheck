// battery-day-plan.js — the card on top of Gear → Batteries: for each kind of battery, how many Ana has (she types her count
// here) and how many the next shooting day will use (battery-day.js).
// Used by: screens/gear-batteries.js

import { html, useState } from '../../vendor/preact-htm.js';
import { formatDate } from '../model.js';
import { clock } from '../battery-rules.js';
import { countBatteries } from '../battery-editing.js';
import { batteryPlan, nextDay } from '../battery-day.js';

function HowManyIHave({ line }) {
  const [count, setCount] = useState(String(line.have));
  const submit = event => { event.preventDefault(); countBatteries(line.groupId, count); };
  return html`
    <form class="battery-plan__count" onSubmit=${submit}>
      <label>I have <input type="number" inputmode="numeric" min="0" value=${count} onInput=${event => setCount(event.target.value)} /></label>
      <button class="btn btn--small" disabled=${line.counted && count === String(line.have)}>Save</button>
      ${!line.counted && html`<small class="warn-text">not counted yet</small>`}
    </form>`;
}

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
          <p><b>${line.battery}</b>: the day needs <b>${line.need}</b>${' '}
            <span class=${line.spare < 0 ? 'warn-text' : 'muted'}>${line.spare < 0 ? `${-line.spare} short` : `${line.spare} spare`}</span></p>
          ${line.groupId && html`<${HowManyIHave} key=${`${line.groupId}-${line.have}`} line=${line} />`}
          ${line.models.map(model => html`
            <p class="muted" key=${model.model}>${model.life
              ? `${model.count} ${model.model} × ${model.takes} × ${model.changes} sets, a change every ${clock(model.life)} h`
              : `${model.count} ${model.model} × ${model.takes}, one set all day`}</p>`)}
        </div>`)}
    </section>`;
}
