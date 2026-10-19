// battery-tag.js — the battery time of a TX, next to its pill (Kit): the same countdown as the mic table's battery
// column (battery-rules.js txTimer), green / yellow / red. Nothing when the TX is OFF.
// Used by: screens/kit.js; useMinuteClock also by parts/battery-cell.js, screens/gear-batteries.js

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { txTimer, clock } from '../battery-rules.js';

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
  const timer = txId && txTimer(project, txId, now);
  if (!timer) return null;
  return html`<span class=${`battery-tag battery--${timer.tone}`}>🔋 ${timer.left == null ? 'ON' : clock(timer.left)}</span>`;
}
