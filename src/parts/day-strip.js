// day-strip.js — THE row of day pills (D1, D2…), the same in Schedule and Cues: finished days are green
// (date past, or today after the ODG's wrap time), the chosen day is black and sits in the middle of the
// row. Tapping a pill chooses that day (for both tabs: they share the chosen day).
// Used by: screens/schedule.js, screens/cues-picker.js

import { html, useEffect, useRef } from '../../vendor/preact-htm.js';
import { dayIsDone, formatDate } from '../model.js';
import { pickDay } from '../state.js';

export function DayStrip({ days, chosen }) {
  const strip = useRef(null);
  // the chosen day's pill in the middle of the row, once the row is on screen
  useEffect(() => {
    const row = strip.current;
    const pill = row?.querySelector('.day-btn--on');
    if (row && pill) row.scrollLeft = pill.offsetLeft - row.offsetLeft - (row.clientWidth - pill.offsetWidth) / 2;
  }, [chosen]);
  return html`
    <div class="day-strip" ref=${strip}>
      ${days.map(d => html`
        <button key=${d.day} class=${'day-btn' + (d.day === chosen ? ' day-btn--on' : '') + (dayIsDone(d) ? ' day-btn--done' : '')}
                onClick=${() => pickDay(d.day)}>
          <b>D${d.day}</b><small>${formatDate(d.date, { weekday: true })}</small>
        </button>`)}
    </div>`;
}
