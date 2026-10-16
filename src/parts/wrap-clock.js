// wrap-clock.js — the end of the shooting day, in the top bar and under it (hours-rules.js):
//   • WrapBadge: "4h 12m to wrap" counting down to the ODG's wrap; after it "+0h 35m" (overtime);
//     gone once the day is wrapped. Tap → the Hours screen (the week, for production).
//   • WrapQuestion: after the ODG's wrap, "Did today finish on time?" Yes / No. No = asked again in
//     an hour: "Is this a wrap?" Yes (type the real wrap) / Not yet — like an alarm's snooze.
// The phone's clock is read every 20 s while the app is open. The day counts from "My call"
// (my-call.js: the crew call, or the person's own when they chose Personal). Crew phones too.
// Used by: main.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { today, span, nowRounded } from '../hours-rules.js';
import { finishedOnTime, notYet, wrappedAt } from '../hours-editing.js';
import { setState } from '../state.js';
import { withMyCalls } from '../my-call.js';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20000);
    const wake = () => setNow(new Date()); // back to the app after a while
    document.addEventListener('visibilitychange', wake);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', wake); };
  }, []);
  return now;
}

export function WrapBadge({ project, myCall }) {
  const now = useClock();
  const day = project && today(withMyCalls(project, myCall), now);
  if (!day || day.phase === 'wrapped') return null;
  const text = day.phase === 'before' ? `${span(day.left)} to wrap` : `+${span(day.over)}`;
  return html`
    <button class=${'badge' + (day.phase === 'before' ? '' : ' badge--warn')} onClick=${() => setState({ screen: 'hours' })}
            title=${`Day ${day.day}: wrap ${day.wrap} on the ODG`}>⏱ ${text}</button>`;
}

export function WrapQuestion({ project, myCall }) {
  const now = useClock();
  const [typing, setTyping] = useState(null); // the real wrap being typed
  const day = project && today(withMyCalls(project, myCall), now);
  if (!day || !['ask', 'ask-wrap'].includes(day.phase)) return null;

  if (typing !== null) {
    return html`
      <div class="wrap-question">
        <b>Wrap time, day ${day.day}</b>
        <input type="time" value=${typing} onInput=${e => setTyping(e.target.value)} aria-label="Real wrap" />
        <button class="btn btn--primary" disabled=${!typing} onClick=${() => { wrappedAt(day.day, typing); setTyping(null); }}>Save</button>
        <button class="btn" onClick=${() => setTyping(null)}>Cancel</button>
      </div>`;
  }
  return day.phase === 'ask' ? html`
    <div class="wrap-question">
      <b>Did today finish on time?</b> <span>ODG wrap ${day.wrap}</span>
      <button class="btn btn--primary" onClick=${() => finishedOnTime(day.day, day.wrap)}>Yes</button>
      <button class="btn" onClick=${() => notYet(day.day)}>No</button>
    </div>` : html`
    <div class="wrap-question">
      <b>Is this a wrap?</b> <span>+${span(day.over)}</span>
      <button class="btn btn--primary" onClick=${() => setTyping(nowRounded(now))}>Yes</button>
      <button class="btn" onClick=${() => notYet(day.day)}>Not yet</button>
    </div>`;
}
