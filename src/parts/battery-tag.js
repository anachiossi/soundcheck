// battery-tag.js — the battery time of a TX, next to its pill (Mics scene tables, Kit): the countdown of the
// battery marked "In use" in it in Gear → Batteries, green / yellow / red (battery-rules.js). Nothing when no
// battery is marked in it.
// Used by: parts/scene-table.js, screens/kit.js, screens/gear-batteries.js (the clock)

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { batteryIn, timeLeft, toneOf, clock } from '../battery-rules.js';

// the countdowns move: a new look every 30 seconds
export function useMinuteClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function BatteryTag({ project, txId }) {
  const now = useMinuteClock();
  const found = txId && batteryIn(project, txId);
  if (!found) return null;
  const { battery, group } = found;
  const time = timeLeft(battery, group, now, project);
  return html`<span class=${`battery-tag battery--${toneOf(battery, group, now, project)}`} title=${`${group?.name || ''} ${battery.label}`}>
    🔋 ${time ? clock(time.left) : battery.label}</span>`;
}
