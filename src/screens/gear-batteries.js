// gear-batteries.js — Gear → Batteries: every battery of the film, by group (AA, NP-F970…), always in
// green / yellow / red (battery-rules.js). Tap a battery: Full · Charging · In use (where) · Empty; its
// clock starts. "+ Group": a name, how many (numbered 1…), the estimated minutes in use and on the charger.
// First version (Ana, 12 Oct: "once we have the aesthetics right we can think of notification triggering
// and other behaviors"): no learning, no notifications yet.
// Used by: main.js

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { STATES, batteryGroups, timeLeft, toneOf, clock, countsOf } from '../battery-rules.js';
import { setBattery, saveGroup } from '../battery-editing.js';
import { Sheet } from '../parts/gear-form.js';

const TONE_OF_STATE = { full: 'green', charging: 'yellow', in_use: '', empty: 'red' };

// the countdowns move: a new look every 30 seconds
function useMinuteClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function GearBatteriesScreen({ state }) {
  const { project } = state;
  const now = useMinuteClock();
  const [battery, setOpenBattery] = useState(null);
  const [group, setOpenGroup] = useState(null);
  const groups = batteryGroups(project);
  return html`
    <div class="gear">
      ${groups.length === 0 && html`<p class="empty">No batteries yet. "+ Group" for each kind: AA ×20, NP-F970 ×5…</p>`}
      ${groups.map(g => {
        const counts = countsOf(g.batteries);
        return html`
          <section class="battery-group" key=${g.id}>
            <header class="battery-group__head">
              <button class="link" onClick=${() => setOpenGroup({ ...g, count: g.batteries.length })}><b>${g.name}</b></button>
              ${STATES.filter(([s]) => counts[s]).map(([s, label]) => html`
                <span key=${s} class=${`chip chip--static battery--${TONE_OF_STATE[s] || 'plain'}`}>${counts[s]} ${label.toLowerCase()}</span>`)}
            </header>
            <div class="battery-grid">
              ${g.batteries.map(b => {
                const time = timeLeft(b, g, now);
                return html`
                  <button key=${b.id} class=${`battery battery--${toneOf(b, g, now)}`} onClick=${() => setOpenBattery({ battery: b, group: g })}>
                    <b>${b.label}</b>
                    <small>${b.state === 'in_use' ? (b.used_in || 'in use') : b.state === 'charging' ? 'charging' : b.state === 'full' ? 'full' : 'empty'}</small>
                    ${time && html`<small class="battery__time">${time.left ? clock(time.left) : b.state === 'charging' ? 'done?' : '0:00'}</small>`}
                  </button>`;
              })}
            </div>
          </section>`;
      })}
      <div class="toolbar"><button class="btn btn--quiet" onClick=${() => setOpenGroup({})}>+ Group</button></div>
      ${battery && html`<${BatterySheet} project=${project} ...${battery} close=${() => setOpenBattery(null)} />`}
      ${group && html`<${GroupSheet} group=${group} close=${() => setOpenGroup(null)} />`}
    </div>`;
}

// where a battery can be in use: the TXs, boom plug-ons and IFB receivers of the film
const placesOf = project => [
  ...(project.transmitters || []).map(t => (/^\d+$/.test(t.id) ? `TX ${t.id}` : t.id)),
  ...(project.ifbReceivers || []).map(r => `RX ${r.id}`),
];

function BatterySheet({ project, battery, group, close }) {
  const [values, setValues] = useState({ state: battery.state, used_in: battery.used_in || '', charge_min: battery.charge_min ?? '' });
  const set = (key, value) => setValues({ ...values, [key]: value });
  const submit = e => {
    e.preventDefault();
    const fields = { state: values.state };
    if (values.state === 'in_use') fields.used_in = values.used_in.trim();
    if (values.state === 'charging' && values.charge_min !== '') fields.charge_min = Number(values.charge_min);
    setBattery(battery.id, fields);
    close();
  };
  return html`<${Sheet} title=${`${group.name} ${battery.label}`} close=${close}>
    <form class="item-form" onSubmit=${submit}>
      <div class="choices">
        ${STATES.map(([s, label]) => html`<button type="button" key=${s} class=${'choice' + (values.state === s ? ' choice--on' : '')}
          onClick=${() => set('state', s)}>${label}</button>`)}
      </div>
      ${values.state === 'in_use' && html`
        <label><span>In</span><input list="battery-places" value=${values.used_in} placeholder="TX 7, B1, Hollyland…" onInput=${e => set('used_in', e.target.value)} />
          <datalist id="battery-places">${placesOf(project).map(p => html`<option key=${p} value=${p} />`)}</datalist></label>`}
      ${values.state === 'charging' && html`
        <label><span>Minutes on this charger</span><input type="number" min="0" value=${values.charge_min}
          placeholder=${group.charge_min ? `${group.charge_min} (the group's)` : 'estimate'} onInput=${e => set('charge_min', e.target.value)} /></label>`}
      <button class="btn btn--primary">Save</button>
    </form></${Sheet}>`;
}

function GroupSheet({ group, close }) {
  const [values, setValues] = useState({ name: group.name || '', count: group.count || '', life_min: group.life_min ?? '', charge_min: group.charge_min ?? '' });
  const set = (key, value) => setValues({ ...values, [key]: value });
  const submit = e => { e.preventDefault(); saveGroup({ ...values, id: group.id }); close(); };
  return html`<${Sheet} title=${group.id ? group.name : 'New group'} close=${close}>
    <form class="item-form" onSubmit=${submit}>
      <label><span>Name</span><input value=${values.name} placeholder="AA, NP-F970…" onInput=${e => set('name', e.target.value)} required autofocus=${!group.id} /></label>
      <label><span>How many (numbered 1…)</span><input type="number" min=${group.count || 0} value=${values.count} onInput=${e => set('count', e.target.value)} /></label>
      <label><span>Minutes in use (estimate)</span><input type="number" min="0" value=${values.life_min} onInput=${e => set('life_min', e.target.value)} /></label>
      <label><span>Minutes to charge (estimate)</span><input type="number" min="0" value=${values.charge_min} onInput=${e => set('charge_min', e.target.value)} /></label>
      <button class="btn btn--primary">Save</button>
    </form></${Sheet}>`;
}
