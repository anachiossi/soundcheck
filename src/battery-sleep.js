// battery-sleep.js — a TX in sleep mode (Ana, 22 Oct: "sometimes I put the TXs in sleep mode… the timer simply
// pause"): its battery countdown stops while it sleeps and goes on from where it was when it wakes.
//   gear/batteries.json  tx_sleep: { '7': since } — TX 7 asleep since then
// How: while a TX sleeps, its timer is read at the moment it fell asleep (timerNow). On waking, the start time of
// its battery (or of its tx_on) moves later by the time it slept, so the time left is the same as when it fell asleep
// and its runs (learning) count only the time it was awake.
// No screen code here. Used by: battery-rules.js, battery-editing.js

export const asleepSince = (file, txId) => (txId == null ? null : file.tx_sleep?.[String(txId)] || null);

// the moment a TX's timer is read at: now, or when it fell asleep
export function timerNow(file, txId, now) {
  const since = asleepSince(file, txId);
  return since ? Math.min(now, Date.parse(since)) : now;
}

// a start time (ISO) moved later by the time asleep
export function wokenSince(since, asleep, now) {
  return new Date(Date.parse(since) + Math.max(0, now - Date.parse(asleep))).toISOString();
}

// the file with the TX awake at `now`: its battery in use (isThisTx picks it) and its tx_on start later.
// A TX that isn't asleep: the file as it was.
export function wake(file, txId, isThisTx, now) {
  const asleep = asleepSince(file, txId);
  if (!asleep) return file;
  const id = String(txId);
  const batteries = file.batteries.map(b =>
    (b.state === 'in_use' && b.since && isThisTx(b) ? { ...b, since: wokenSince(b.since, asleep, now) } : b));
  const txOn = { ...file.tx_on };
  if (txOn[id]) txOn[id] = wokenSince(txOn[id], asleep, now);
  const txSleep = { ...file.tx_sleep };
  delete txSleep[id];
  return { ...file, batteries, tx_on: txOn, tx_sleep: txSleep };
}

// the file with the TX asleep since `at` (ISO)
export const sleep = (file, txId, at) => ({ ...file, tx_sleep: { ...file.tx_sleep, [String(txId)]: at } });
