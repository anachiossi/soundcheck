// alarm-timeline.js — the next morning as one timeline, read top to bottom (Ana, 18 Nov). The day on top (with the
// violet "2nd unit" mark when it has one), the days that get no alarm in plain words, then one line per moment: the
// time, a dot on one rail, what happens. The two black dots are the alarms that ring; the others are hollow.
// The rows come from alarm-timeline-rules.js; every time is the alarm robot's (parts/robot-plan.js).
// Each dot sits in the middle of the rail by construction (app.css → "the morning as a timeline"): Ana asked that the
// lines look right.
// onOpen (the card on Hours): tapping the timeline opens the alarm page, to change the minutes.
// Used by: parts/tomorrow.js, screens/alarms.js

import { html } from '../../vendor/preact-htm.js';
import { formatDate, localTodayIso } from '../model.js';
import { hasSecondUnit, skippedDaysText, timelineRows } from '../alarm-timeline-rules.js';

export function AlarmTimeline({ project, plan, onOpen }) {
  const rows = timelineRows(plan, { rideGap: project.settings?.commute?.ride_gap_if_unknown ?? 40 });
  const skipped = skippedDaysText(project, plan, localTodayIso());
  const open = onOpen && { role: 'button', tabIndex: 0, onClick: onOpen, onKeyDown: event => event.key === 'Enter' && onOpen() };
  return html`
    <div class="alarm-day">
      <b>${formatDate(plan.date, { weekday: true })} · D${plan.day}</b>
      ${hasSecondUnit(project, plan) && html`<span class="unit2-mark">2nd unit</span>`}
    </div>
    ${skipped && html`<p class="muted alarm-skipped">${skipped}</p>`}
    <ol class=${onOpen ? 'alarm-timeline alarm-timeline--open' : 'alarm-timeline'} ...${open || {}}>
      ${rows.map(row => html`
        <li key=${row.time + row.title} class=${row.rings ? 'alarm-timeline__row alarm-timeline__row--rings' : 'alarm-timeline__row'}>
          <time>${row.time}</time>
          <span class="alarm-timeline__dot"></span>
          <span class="alarm-timeline__what">${row.rings ? html`<b>${row.title}</b>` : row.title}${row.note && html`<small>${row.note}</small>`}</span>
        </li>`)}
    </ol>`;
}

// 'Set the 2 alarms' (or 'Set the alarm' when the leave alarm is the walking-out time)
export const setAlarmsLabel = plan => (timelineRows(plan).filter(row => row.rings).length > 1 ? 'Set the 2 alarms' : 'Set the alarm');
