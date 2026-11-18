// month-calendar.js — Today → Calendar: the film as a small month calendar (Ana 3 Nov: "the source of
// truth for when I work", before going into details). Every shooting day is a tappable box with its day
// number (D56); a day already over is grey; today has a ring. Tapping a day opens it.
// What else each day shows is chosen per film in Film rules (overview-rules.js calendarMarks):
//   2nd unit days: violet with "2nd" (Ana works those days on Il colpo)
//   Speakers and lavs: the most speakers and the most lavaliers in one scene that day
// It follows the schedule, so a new PDL or ODG moves the days here as soon as it is accepted.
// Dates are 'YYYY-MM-DD' strings; the weekday is worked out at noon UTC, so no day ever shifts.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { shootingDays, dayIsDone } from '../model.js';
import { openDay } from '../state.js';
import { calendarMarks, dayMost } from '../overview-rules.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

const pad = n => String(n).padStart(2, '0');
const daysIn = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();   // month: 1–12
const mondayFirst = (year, month) => (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;

function todayText(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ['2026-10', '2026-11', …] from the first shooting month to the last
function monthsBetween(first, last) {
  const months = [];
  let [year, month] = first.split('-').map(Number);
  const [lastYear, lastMonth] = last.split('-').map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push([year, month]);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}

// the small lines under the day's number, for a film that marks speakers and lavs
function DayCounts({ project, day }) {
  const { speakers, lavs, unsure } = dayMost(project, day);
  return html`${(speakers > 0 || unsure) && html`<small>${speakers}${unsure ? '+' : ''} sp</small>`}${lavs > 0 && html`<small>${lavs} lav</small>`}`;
}

export function CalendarScreen({ state }) {
  const { project } = state;
  const days = shootingDays(project).filter(d => d.date);
  if (!days.length) return html`<p class="empty">No shooting dates yet.</p>`;
  const byDate = new Map(days.map(d => [d.date, d]));
  const today = todayText();
  const marksUnits = calendarMarks(project.settings) === 'second-unit';
  const withSecond = days.filter(d => d.second).length;
  return html`
    <p class="summary"><b>${days.length} shooting days</b>${!marksUnits ? ' · sp = most speakers, lav = most lavaliers in a scene'
      : withSecond ? html` · <span class="unit2-mark">2nd</span> ${withSecond} with a 2nd unit` : ''}</p>
    ${monthsBetween(days[0].date.slice(0, 7), days[days.length - 1].date.slice(0, 7)).map(([year, month]) => html`
      <div class="calendar" key=${`${year}-${month}`}>
        <h3 class="calendar__month">${MONTHS[month - 1]} ${year}</h3>
        <div class="calendar__grid">
          ${WEEKDAYS.map(name => html`<span class="calendar__weekday" key=${name}>${name}</span>`)}
          ${Array.from({ length: mondayFirst(year, month) }, (_, i) => html`<span key=${'blank' + i}></span>`)}
          ${Array.from({ length: daysIn(year, month) }, (_, i) => {
            const date = `${year}-${pad(month)}-${pad(i + 1)}`;
            const day = byDate.get(date);
            const ring = date === today ? ' calendar__day--today' : '';
            if (!day) return html`<span key=${date} class=${'calendar__day calendar__day--off' + ring}>${i + 1}</span>`;
            const second = marksUnits && day.second;
            const look = (second ? ' calendar__day--unit2' : '') + (dayIsDone(day) ? ' calendar__day--done' : '');
            return html`
              <button key=${date} class=${'calendar__day' + look + ring} onClick=${() => openDay(day.day)}
                      title=${second ? `Day ${day.day} · 2nd unit ${day.second.name}` : `Day ${day.day}`}>
                <span>${i + 1}</span><small>D${day.day}</small>${second && html`<small class="calendar__unit2">2nd</small>`}
                ${!marksUnits && html`<${DayCounts} project=${project} day=${day} />`}
              </button>`;
          })}
        </div>
      </div>`)}`;
}
