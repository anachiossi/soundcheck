// battery-cell.js — the Battery column of the mic table (Ana, 13 Oct): "When I'm rigging the actors I put everything
// and I wanted to toggle a button: ON. From the moment I toggle it, a countdown starts."
//   OFF (grey): one tap → ON, the countdown starts.
//   ON: the time left big after a clock ("🕒 6:21"), green / yellow / red, and under it, after an empty battery, the time
//   of day it runs out ("02:53", Ana 18 Oct).
//   Tap again → a sheet: "Swap battery" (the countdown starts again) or OFF.
// No battery numbers here, and Gear → Batteries is never changed from here (Ana, 19 Oct: telling the app "charging…
// charged…" at every swap was too slow; Gear stays for timing the charges, when she wants to).
// The timer belongs to the TX, not the character; it lives in gear/batteries.json (battery-rules.js txTimer), so it
// keeps running offline (only the start time is stored; the phone's clock does the rest).
// Used by: parts/scene-table.js, parts/scene-editor.js

import { html, useState } from '../../vendor/preact-htm.js';
import { txTimer, clock, timeOfDay, placeOfTx } from '../battery-rules.js';
import { switchTx } from '../battery-editing.js';
import { useMinuteClock } from './battery-tag.js';
import { Sheet } from './gear-form.js';
import { Icon } from './icons.js';

export function BatteryCell({ project, txId, character }) {
  const now = useMinuteClock();
  const [open, setOpen] = useState(false);
  if (!txId) return html`<span class="pill pill--missing">—</span>`;
  const timer = txTimer(project, txId, now);
  const tap = () => (timer ? setOpen(true) : switchTx(project, txId));
  return html`
    <button class="edit-cell" onClick=${tap} aria-label=${`${placeOfTx(txId)} battery`}>
      ${timer
        ? html`<span class=${`pill pill--tx pill--tx-freq battery-pill battery--${timer.tone}`}>
            <b class="battery-pill__at">${timer.left == null ? 'ON' : html`<${Icon} name="clock" label="time left" />${clock(timer.left)}`}</b>
            ${timer.endsAt && html`<small class="battery-pill__at"><${Icon} name="battery_empty" label="flat at" />${timeOfDay(timer.endsAt)}</small>`}</span>`
        : html`<span class="pill pill--tx battery-pill battery--plain"><b>OFF</b></span>`}
    </button>
    ${open && timer && html`<${TxBatterySheet} project=${project} txId=${txId} character=${character} timer=${timer} close=${() => setOpen(false)} />`}`;
}

function TxBatterySheet({ project, txId, character, timer, close }) {
  const go = options => { switchTx(project, txId, options); close(); };
  return html`<${Sheet} title=${`${placeOfTx(txId)}${character ? ` · ${character.name}` : ''}`} close=${close}>
    <p class="muted">ON at ${timeOfDay(Date.parse(timer.since))}
      ${timer.endsAt && html` · change at <b>${timeOfDay(timer.endsAt)}</b>`}
      ${timer.notes.length > 0 && html`<br />${timer.notes.join(' · ')}`}</p>
    <div class="toolbar">
      <button type="button" class="btn btn--primary" onClick=${() => go({})}>Swap battery</button>
      <button type="button" class="btn" onClick=${() => go({ off: true })}>OFF</button>
    </div>
  <//>`;
}
