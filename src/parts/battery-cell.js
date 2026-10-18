// battery-cell.js — the Battery column of the mic table (Ana, 13 Oct): "When I'm rigging the actors I put everything
// and I wanted to toggle a button: ON. From the moment I toggle it, a countdown starts."
//   OFF (grey) until tapped → a sheet: tap a battery number (the fitting groups, best first) or "ON, no number".
//   ON: the time left big after a clock ("🕒 6:21"), green / yellow / red, and under it, after an empty battery, the time
//   of day it runs out ("02:53", Ana 18 Oct).
//   Tap again → how did it end (Dead · Low · Still OK, for learning) + the next battery, or OFF.
// The timer belongs to the TX, not the character; it lives in gear/batteries.json (battery-rules.js txTimer), so it
// keeps running offline (only the start time is stored; the phone's clock does the rest).
// Used by: parts/scene-table.js

import { html, useState } from '../../vendor/preact-htm.js';
import { txTimer, groupsForTx, batteryFile, clock, timeOfDay, ENDS, placeOfTx } from '../battery-rules.js';
import { switchTx } from '../battery-editing.js';
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

function TxBatterySheet({ project, txId, character, timer, now, close }) {
  const [end, setEnd] = useState('');
  const groups = groupsForTx(project, txId);
  const { batteries } = batteryFile(project);
  const go = options => { switchTx(project, txId, { end: end || undefined, ...options }); close(); };
  return html`<${Sheet} title=${`${placeOfTx(txId)}${character ? ` · ${character.name}` : ''}`} close=${close}>
    ${timer && html`
      <p class="muted">${timer.battery ? `${timer.group?.name || ''} ${timer.battery.label}` : 'No number'} · ON at ${timeOfDay(Date.parse(timer.since))}
        ${timer.endsAt && html` · change at <b>${timeOfDay(timer.endsAt)}</b>`}
        ${timer.notes.length > 0 && html`<br />${timer.notes.join(' · ')}`}</p>
      ${timer.battery && html`
        <p class="sheet__hint">How did it end?</p>
        <div class="choices">
          ${ENDS.map(([key, label]) => html`<button type="button" key=${key} class=${'choice' + (end === key ? ' choice--on' : '')}
            onClick=${() => setEnd(end === key ? '' : key)}>${label}</button>`)}
        </div>`}`}
    <p class="sheet__hint">${timer ? 'Swap: the next battery' : 'Battery'}</p>
    ${groups.map(group => {
      const ready = batteries.filter(b => b.group === group.id && b.state === 'full');
      return html`<div key=${group.id} class="battery-pick">
        <small>${group.name}</small>
        <div class="choices">
          ${ready.length ? ready.map(b => html`<button type="button" key=${b.id} class="choice battery--green" onClick=${() => go({ batteryId: b.id })}>${b.label}</button>`)
            : html`<span class="muted">none full</span>`}
        </div></div>`;
    })}
    <div class="toolbar">
      <button class="btn btn--primary" onClick=${() => go({})}>${timer ? 'Swap, no number' : 'ON, no number'}</button>
      ${timer && html`<button class="btn" onClick=${() => go({ off: true })}>OFF</button>`}
    </div>
  <//>`;
}
