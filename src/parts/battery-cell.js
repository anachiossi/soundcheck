// battery-cell.js — the Battery column of the mic table (Ana, 13 Oct): "When I'm rigging the actors I put everything
// and I wanted to toggle a button: ON. From the moment I toggle it, a countdown starts."
//   OFF (grey) until tapped → a sheet: tap a battery number (the fitting groups, best first) or "ON, no number".
//   ON: the time left big after a clock ("🕒 6:21"), green / yellow / red, and under it, after an empty battery, the time
//   of day it runs out ("02:53", Ana 18 Oct).
//   Tap again → how did it end (Dead · Low · Still OK, for learning) + the next battery, or OFF.
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
import { switchTx, setOnTime } from '../battery-editing.js';
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
        ? html`<span class=${`pill pill--tx pill--tx-freq battery-pill battery--${timer.tone}`}>
            <b class="battery-pill__at">${timer.left == null ? 'ON' : html`<${Icon} name="clock" label="time left" />${clock(timer.left)}`}</b>
            ${timer.endsAt && html`<small class="battery-pill__at"><${Icon} name="battery_empty" label="flat at" />${timeOfDay(timer.endsAt)}</small>`}</span>`
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
  <//>`;
}
