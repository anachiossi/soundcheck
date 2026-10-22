// battery-cell.js — the Battery column of the mic table (Ana, 13 Oct): "When I'm rigging the actors I put everything
// and I wanted to toggle a button: ON. From the moment I toggle it, a countdown starts."
//   OFF (grey) until tapped → a sheet: tap a battery number (the fitting groups, best first) or "ON, no number".
//   ON: the time left big after a clock ("🕒 6:21"), green / yellow / red, and under it, after an empty battery, the time
//   of day it runs out ("02:53", Ana 18 Oct).
//   Tap again → how did it end (Dead · Low · Still OK, for learning) + the next battery, or OFF, or Sleep / Wake
//   (Ana, 22 Oct: a TX in sleep mode pauses its countdown; "SLEEP" under the time left, the pill blue like frozen time).
//   "Turned on at" (Ana, 22 Oct: "many times I forget to click ON"): the time it really went on, now unless changed;
//   on a TX already ON it corrects the start of its countdown. A time typed stays the default for 10 minutes, so
//   the other lavs turned on at the same moment take one tap each.
//   The battery that comes out goes straight to Charging and is offered again once its charge time is up (Ana,
//   19 Oct): the numbers here are the ready ones — full, or charged by now.
// The timer belongs to the TX, not the character; it lives in gear/batteries.json (battery-rules.js txTimer), so it
// keeps running offline (only the start time is stored; the phone's clock does the rest).
// Used by: parts/scene-table.js, parts/scene-editor.js

import { html, useState } from '../../vendor/preact-htm.js';
import { txTimer, groupsForTx, batteryFile, isReady, clock, timeOfDay, ENDS, placeOfTx, momentAt } from '../battery-rules.js';
import { switchTx, setOnTime, sleepTx, wakeTx, sleptTx } from '../battery-editing.js';
import { useMinuteClock } from './battery-tag.js';
import { Sheet } from './gear-form.js';
import { Icon } from './icons.js';

export function BatteryCell({ project, txId, character }) {
  const now = useMinuteClock();
  const [open, setOpen] = useState(false);
  if (!txId) return html`<span class="pill pill--missing">—</span>`;
  const timer = txTimer(project, txId, now);
  return html`
    <button class="edit-cell" onClick=${() => setOpen(true)} aria-label=${`${placeOfTx(txId)} battery`}>
      ${timer
        ? html`<span class=${`pill pill--tx pill--tx-freq battery-pill battery--${timer.asleep ? 'asleep' : timer.tone}`}>
            <b class="battery-pill__at">${timer.left == null ? 'ON' : html`<${Icon} name="clock" label="time left" />${clock(timer.left)}`}</b>
            ${timer.endsAt && html`<small class="battery-pill__at"><${Icon} name="battery_empty" label="flat at" />${timeOfDay(timer.endsAt)}</small>`}
            ${timer.asleep && html`<small class="battery-pill__at">SLEEP</small>`}</span>`
        : html`<span class="pill pill--tx battery-pill battery--plain"><b>OFF</b></span>`}
    </button>
    ${open && html`<${TxBatterySheet} project=${project} txId=${txId} character=${character} timer=${timer} now=${now} close=${() => setOpen(false)} />`}`;
}

// the last "Turned on at" typed, offered again for 10 minutes (the next lavs went on at the same time)
let typedOnTime = { time: '', at: 0 };
const hhmm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function TxBatterySheet({ project, txId, character, timer, now, close }) {
  const [end, setEnd] = useState('');
  const recent = Date.now() - typedOnTime.at < 10 * 60000 ? typedOnTime.time : '';
  const [onTime, setOnTimeTyped] = useState(timer ? hhmm(Date.parse(timer.since)) : recent || hhmm(Date.now()));
  const groups = groupsForTx(project, txId);
  const { batteries } = batteryFile(project);
  const typed = value => { setOnTimeTyped(value); typedOnTime = { time: value, at: Date.now() }; };
  // a battery chosen while OFF goes in at the time typed; a swap on a TX already ON goes in now
  const onAt = () => (!timer && onTime && onTime !== hhmm(Date.now()) ? momentAt(onTime) : null);
  const go = options => { switchTx(project, txId, { end: end || undefined, onAt: options.off ? null : onAt(), ...options }); close(); };
  const timeBox = html`<input type="time" class="battery-on-time" value=${onTime} onInput=${e => typed(e.target.value)} aria-label="Turned on at" />`;
  return html`<${Sheet} title=${`${placeOfTx(txId)}${character ? ` · ${character.name}` : ''}`} close=${close}>
    ${timer && html`
      <div class="battery-on">ON at ${timeBox}
        ${onTime && onTime !== hhmm(Date.parse(timer.since)) && html`<button class="btn btn--primary"
          onClick=${() => { setOnTime(project, txId, momentAt(onTime)); close(); }}>Save time</button>`}</div>
      <p class="muted">${timer.battery ? `${timer.group?.name || ''} ${timer.battery.label}` : 'No number'}
        ${timer.endsAt && html` · change at <b>${timeOfDay(timer.endsAt)}</b>`}
        ${timer.notes.length > 0 && html`<br />${timer.notes.join(' · ')}`}</p>
      ${timer.battery && html`
        <p class="sheet__hint">How did it end?</p>
        <div class="choices">
          ${ENDS.map(([key, label]) => html`<button type="button" key=${key} class=${'choice' + (end === key ? ' choice--on' : '')}
            onClick=${() => setEnd(end === key ? '' : key)}>${label}</button>`)}
        </div>`}`}
    ${!timer && html`<div class="battery-on">Turned on at ${timeBox}</div>`}
    <p class="sheet__hint">${timer ? 'Swap: the next battery' : 'Battery'}</p>
    ${groups.map(group => {
      const ready = batteries.filter(b => b.group === group.id && isReady(project, b, group, now));
      return html`<div key=${group.id} class="battery-pick">
        <small>${group.name}</small>
        <div class="choices">
          ${ready.length ? ready.map(b => html`<button type="button" key=${b.id} class="choice battery--green" onClick=${() => go({ batteryId: b.id })}>${b.label}</button>`)
            : html`<span class="muted">none ready</span>`}
        </div></div>`;
    })}
    <div class="toolbar">
      <button class="btn btn--primary" onClick=${() => go({})}>${timer ? 'Swap, no number' : 'ON, no number'}</button>
      ${timer && html`<button class="btn" onClick=${() => go({ off: true })}>OFF</button>`}
    </div>
    ${timer && html`<${SleepRow} project=${project} txId=${txId} timer=${timer} close=${close} />`}
  <//>`;
}

// sleep mode (battery-sleep.js): the countdown pauses, and goes on from there when the TX wakes. The time is now,
// or earlier when Ana forgot to tap ("it happened at 13:15"). Forgot both (Ana, 22 Oct)? On a TX awake:
// "Slept from 13:00 to 14:00" adds that sleep afterwards. The two times typed stay for 10 minutes (lunch: every lav).
let typedSleep = { from: '', to: '', at: 0 };

function SleepRow({ project, txId, timer, close }) {
  const [time, setTime] = useState(hhmm(Date.now()));
  const recent = Date.now() - typedSleep.at < 10 * 60000 ? typedSleep : { from: '', to: '' };
  const [from, setFrom] = useState(recent.from);
  const [to, setTo] = useState(recent.to);
  const go = action => { action(project, txId, new Date(momentAt(time)).toISOString()); close(); };
  const remember = (nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); typedSleep = { from: nextFrom, to: nextTo, at: Date.now() }; };
  const fromAt = from && momentAt(from);
  const toAt = to && momentAt(to);
  const valid = fromAt && toAt && toAt > fromAt && fromAt >= Date.parse(timer.since);
  const addSleep = () => { sleptTx(project, txId, new Date(fromAt).toISOString(), new Date(toAt).toISOString()); close(); };
  return html`
    <p class="sheet__hint">${timer.asleep ? `Asleep since ${timeOfDay(Date.parse(timer.asleep))}: the timer is paused` : 'Sleep mode: the timer pauses'}</p>
    <div class="battery-on">
      <input type="time" class="battery-on-time" value=${time} onInput=${event => setTime(event.target.value)} aria-label="at" />
      ${timer.asleep
        ? html`<button class="btn btn--primary" onClick=${() => go(wakeTx)}>Wake</button>`
        : html`<button class="btn" onClick=${() => go(sleepTx)}>Sleep</button>`}
    </div>
    ${!timer.asleep && html`
      <p class="sheet__hint">Forgot to tap? It slept</p>
      <div class="battery-on">from
        <input type="time" class="battery-on-time" value=${from} onInput=${event => remember(event.target.value, to)} aria-label="asleep from" />
        to <input type="time" class="battery-on-time" value=${to} onInput=${event => remember(from, event.target.value)} aria-label="awake at" />
        <button class="btn btn--primary" disabled=${!valid} onClick=${addSleep}>Add</button>
      </div>`}`;
}
